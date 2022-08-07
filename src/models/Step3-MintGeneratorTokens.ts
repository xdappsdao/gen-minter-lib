
import { downloadFileFromFbStorage, uploadJSONFileToIPFS, uploadMediaFileToIPFS } from "@xdappsdao/general-utils/lib";
import { ethers } from "ethers";
import * as admin from "firebase-admin";
const fs = require('fs');
const SA = process.env.SERVICE_ACCOUNT ? process.env.SERVICE_ACCOUNT : '';

export class MintGeneratorTokens {
  chainId: number;
  saleSplitterAddress: string;
  royaltySplitterAddress: string;
  totalRoyaltyFactor: number;
  uid: string;
  generatorAddress: string;

  constructor(chainId: number, generatorAddress: string, saleSplitterAddress: string, royaltySplitterAddress: string, totalRoyaltyFactor: number, uid: string) {
    this.chainId = chainId;
    this.royaltySplitterAddress = royaltySplitterAddress.toLowerCase();
    this.saleSplitterAddress = saleSplitterAddress.toLowerCase();
    this.uid = uid;
    this.generatorAddress = generatorAddress.toLowerCase();
    this.totalRoyaltyFactor = totalRoyaltyFactor;
  }

  async mintGeneratorToken(provider: ethers.providers.JsonRpcProvider, db: admin.firestore.Firestore): Promise<unknown> {
    const project = await this._getProjectDataFromFirebase(db);
    const newTokenId = await this._mintTokens(project, provider, db);
    await this._saveMintResults(newTokenId, db);
    await this._saveDeployCollectionRequest(db);
    await this._deleteMintTriggerDoc(db)
    return;
  }

  async _mintTokens(projectData: Record<string, unknown>, provider: ethers.providers.JsonRpcProvider, db: admin.firestore.Firestore): Promise<number> {
    const qty = projectData?.totalSupply as number;
    const creator = projectData?.creatorAddress as string;
    const walletMnemonic = ethers.Wallet.fromMnemonic(SA);
    const abi = ["function mintItem(string memory newTokenURI, uint256 _qty, uint256 _royalty, address _royaltyAddress, address _creator, address _paymentAddress, uint256 _salePrice) public returns(uint256)"]
    const contract = new ethers.Contract(this.generatorAddress, abi, walletMnemonic.connect(provider));
    const royaltyAddress = this.royaltySplitterAddress;
    const paymentAddress = this.saleSplitterAddress;
    const salePriceFormatted = ethers.utils.formatEther(projectData.generatorTokenCost as number);
    const uri = await this._createMetaData(projectData);
    const result = await contract.mintItem(uri, qty, this.totalRoyaltyFactor, royaltyAddress, creator, paymentAddress, salePriceFormatted);
    const tx = await result.wait();
    const data = tx.logs[0].data;
    const decodedData = ethers.utils.defaultAbiCoder.decode(["uint256", "uint256"], data);
    const newTokenId = decodedData[0].toNumber();
    const dataToUpdate = {
      mintBlock: tx.blockNumber,
      newTokenId: newTokenId,
      isMinted: true
    }
    const pathToUpdate = `requests/mintGen/tbMintedGen`;
    await db.collection(pathToUpdate).doc(this.uid).update(dataToUpdate);
    return newTokenId;
  }

  async _saveMintResults(tokenId: number, db: admin.firestore.Firestore): Promise<unknown> {
    const path = `genTracking/approvals/pendingSetup`;
    const dataToSave = {
      generatorTokenId: tokenId,
      saleSplitterAddress: this.saleSplitterAddress,
      royaltySplitterAddress: this.royaltySplitterAddress,
    }
    return await db.collection(path).doc(this.uid).update(dataToSave);
  }

  async _saveDeployCollectionRequest(db: admin.firestore.Firestore): Promise<unknown> {
    const pathToSaveResult = `requests/deployCollection/tbDeployedCollection`;
    const dataToSave = {
      uid: this.uid,
      chainId: this.chainId
    }
    return await db.collection(pathToSaveResult).doc(this.uid).set(dataToSave);
  }

  async _deleteMintTriggerDoc(db: admin.firestore.Firestore): Promise<unknown> {
    const pathToDelete = `requests/mintGen/tbMintedGen`;
    return await db.collection(pathToDelete).doc(this.uid).delete();
  }

  async _getProjectDataFromFirebase(db: admin.firestore.Firestore): Promise<Record<string, unknown>> {
    const projectDocPath = `genTracking/approvals/pendingSetup/${this.uid}`
    const doc = await db.doc(projectDocPath).get();
    const projectData = doc.data()
    return projectData;
  }



  async _createMetaData(projectData: Record<string, unknown>): Promise<string> {
    const collectionName = projectData.name as string;
    const creatorAddress = projectData.creatorAddress as string;
    const totalSupply = projectData.totalSupply as number;
    const description = `${collectionName} - a collection of ${totalSupply} unique user generated NFTs.`;
    const name = `${collectionName} - Generator Token`;
    const uid = projectData.uid as string;
    const tokenImageFileName = projectData.generatorTokenImageFileName as string;
    const animationFileName = projectData.generatorTokenAnimationFileName as string;
    const imageUri = await this._getTokenImageHash(creatorAddress, uid, tokenImageFileName);
    console.log("imageUri", imageUri);
    const animationUri = await this._getAnimationUriFileHash(creatorAddress, uid, animationFileName);
    const metaData = {
      name: name,
      image: imageUri,
      animation_url: animationUri,
      description: description,
      uid: uid
    }
    const mdUri = await uploadJSONFileToIPFS(metaData);
    console.log("mdUri", mdUri);
    return mdUri;
  }
  async _getTokenImageHash(userAddress: string, projectUid: string, fileName: string): Promise<string> {
    if (fileName.length > 0) {
      const bucketName = "gs://nft-apps.appspot.com";
      const folderName = `layer-options/${userAddress}/${projectUid}`;
      const pathToSave = `images/${projectUid}/${fileName}`;
      const filePath = await downloadFileFromFbStorage(bucketName, folderName, fileName, pathToSave);
      console.log("filePath11", filePath);
      const result = await uploadMediaFileToIPFS(filePath);
      return result;
    } else {
      return "";
    }
  }

  async _getAnimationUriFileHash(userAddress: string, projectUid: string, fileName: string): Promise<string> {
    if (fileName.length > 0) {
      const bucketName = "gs://nft-apps.appspot.com";
      const folderName = `layer-options/${userAddress}/${projectUid}/${fileName}`;
      const destFileName = `images/${projectUid}/${fileName}`;
      const filePath = await downloadFileFromFbStorage(bucketName, folderName, fileName, destFileName);
      const result = await uploadMediaFileToIPFS(filePath);
      return result;
    } else {
      return "";
    }
  }
}