import { deleteFBDoc, getFBDocData, setFirebaseDoc, updateFirebaseDoc } from "@xdappsdao/fb-utils/lib";
import { deleteDirectoryUsed, downloadFileFromFbStorage, uploadJSONFileToIPFS, uploadMediaFileToIPFS } from "@xdappsdao/general-utils/lib";
import { ethers } from "ethers";
import * as admin from "firebase-admin";
import { checkIfShuffleIdHasBeenMinted } from "../utils/checkIfShuffleIdHasBeenMinted";
import { getShuffleResultById } from "../utils/getShuffleResultById";
const SA = process.env.SERVICE_ACCOUNT ? process.env.SERVICE_ACCOUNT : '';

class MintManager {
  shuffleId: number;
  contractAddress: string;
  chainId: number;
  imageHash?: string;
  constructor(shuffleId: number, chainId: number, contractAddress: string) {
    this.shuffleId = shuffleId
    this.chainId = chainId
    this.contractAddress = contractAddress.toLowerCase();
  }

  async handleMintRequest(db: admin.firestore.Firestore) {
    // Step 1 confirm not already minted
    const isMinted = await checkIfShuffleIdHasBeenMinted(this.chainId, this.contractAddress, this.shuffleId, db);
    if (!isMinted) {
      this._step2UpdateMintDocToInProcess(db);
      const shuffleResult = await this._step3GetShuffleResult(db);
      if (shuffleResult) {
        const shuffledImageFilePath = await this._step4DownloadShuffledImage(db);
        const user = shuffleResult?.user as string;
        const settingsDocUid = `chain_${this.chainId.toString()}`;
        const settingsData = await getFBDocData("settings", settingsDocUid, db);
        const rpc = settingsData?.rpcURL as string;
        const shuffleContractAddress = settingsData?.shuffleContractAddress as string;
        const provider = new ethers.providers.JsonRpcProvider(rpc);
        const tokenId = await this._getNextTokenId(provider);
        const uri = await this._step5GetMetaDataUriToMint(shuffledImageFilePath, shuffleResult, tokenId, db);
        await this._step6MintShuffle(user, tokenId, shuffleContractAddress, uri, provider, db);
        const pathToDelete = `images/${this.shuffleId.toString()}`;
        deleteDirectoryUsed(pathToDelete);
      } else {
        console.error("shuffleResult is undefined");
      }
    }
  }

  async _step2UpdateMintDocToInProcess(db: admin.firestore.Firestore): Promise<unknown> {
    const dataToUpdate = { inProcess: true };
    const path = `genTracking/chain_${this.chainId.toString()}/tbpMint`;
    return await updateFirebaseDoc(path, `shuffleId_${this.shuffleId.toString()}`, dataToUpdate, db);
  }
  async _step3GetShuffleResult(db: admin.firestore.Firestore): Promise<Record<string, unknown>> {
    return await getShuffleResultById(this.chainId, this.shuffleId, db);
  }
  async _step4DownloadShuffledImage(db: admin.firestore.Firestore): Promise<string> {
    const fileName = `shuffle_${this.shuffleId.toString()}.png`;
    const dlFrom = `genShuffles`;
    const dlTo = `images/${this.shuffleId.toString()}/${fileName}`;
    const bucketName = "gs://nft-apps.appspot.com";
    const filePath = await downloadFileFromFbStorage(bucketName, dlFrom, fileName, dlTo);
    return filePath;
  }
  async _step5GetMetaDataUriToMint(imagePath: string, shuffleResult: Record<string, unknown>, tokenId: number, db: admin.firestore.Firestore): Promise<string> {
    const projectName = shuffleResult?.name as string;
    const maxSupply = shuffleResult?.totalSupply as number;
    const shuffleId = shuffleResult?.shuffleId as number;
    const attributes = shuffleResult?.attributes as Record<string, unknown>[];
    this.imageHash = await this._uploadToIPFSAndGetImageHash(imagePath);
    const metaData = {
      name: this._getMetaDataTitle(projectName, tokenId),
      description: this._getMetaDataDescription(projectName, maxSupply, shuffleId),
      image: this.imageHash,
      attributes: attributes
    };
    return await this._getMetaHash(metaData);
  }
  async _step6MintShuffle(user: string, nextTokenId: number, shuffleContractAddress: string, mdHash: string, provider: ethers.providers.JsonRpcProvider, db: admin.firestore.Firestore): Promise<unknown> {
    const walletMnemonic = ethers.Wallet.fromMnemonic(SA);
    const abiShuffle = ["function mintRequestedToken(address _minter, uint256 _shuffleIdMinted, uint256 _tokenIdExpected, string memory _mdHash, string memory _imageHash) external"];
    const shuffleContract = new ethers.Contract(shuffleContractAddress, abiShuffle, walletMnemonic.connect(provider));
    shuffleContract.signer.connect(provider);
    try {
      const result = await shuffleContract.mintRequestedToken(user, this.shuffleId, nextTokenId, mdHash, this.imageHash);
      console.log("result ", result);
      await result.wait();
      const imgHashCleaned = this.imageHash.replace("ipfs://", "");
      const dataToUpdateSave = {
        blockNumber: result.blockNumber,
        contractAddress: this.contractAddress,
        imageHash: imgHashCleaned,
        shuffleId: this.shuffleId,
        tokenId: nextTokenId,
        txHash: result.hash,
        user: user
      };
      const pathSave = `genTracking/chain_${this.chainId.toString()}/active/${this.contractAddress}/mintedHashes`;
      return await setFirebaseDoc(pathSave, imgHashCleaned, dataToUpdateSave, db);
    } catch (error) {
      const errorData = {
        error: error.message,
        chainId: this.chainId,
        contractAddress: this.contractAddress,
        other: `error minting shuffle Id ${this.shuffleId.toString()}`
      }
      await setFirebaseDoc(`errors`, `shuffle_${this.shuffleId.toString()}`, errorData, db);
      return console.log("result ", error);
    }
  }
  async _uploadToIPFSAndGetImageHash(filePath: string): Promise<string> {
    try {
      const hash = await uploadMediaFileToIPFS(filePath);
      console.log("hash", hash)
      return hash;
    } catch (err) {
      console.error(err);
      return "";
    }
  }

  _getMetaDataTitle(projectName: string, tokenId: number): string {
    return `#${tokenId.toString()} - ${projectName}`
  }
  async _getNextTokenId(provider: ethers.providers.JsonRpcProvider): Promise<number> {
    const abi: string[] = ["function getNextTokenId() public view returns (uint256)"];
    const tokenContract = new ethers.Contract(this.contractAddress, abi, provider);
    const nextTokenIdBN = await tokenContract.getNextTokenId();
    return nextTokenIdBN.toNumber();
  }
  _getMetaDataDescription(projectName: string, maxSupply: number, shuffleId: number): string {
    const desc = `${projectName} is a unique collection of ${maxSupply} max supply and dynamically generated by it's minters! This token was generated from shuffle ID #${shuffleId.toString()}.`;
    return desc;
  }
  async _getMetaHash(metaData: Record<string, unknown>): Promise<string> {
    const hashToReturn = await uploadJSONFileToIPFS(metaData);
    console.log("hashToReturn", hashToReturn);
    return `ipfs://${hashToReturn}`;
  }
}
export default MintManager;