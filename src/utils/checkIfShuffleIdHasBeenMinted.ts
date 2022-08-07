
import * as admin from "firebase-admin";
export const checkIfShuffleIdHasBeenMinted = async (chainId: number, contractAddress: string, shuffleId: number, db: admin.firestore.Firestore): Promise<boolean> => {
  const path = `genTracking/chain_${chainId.toString()}/active/${contractAddress}/mintedTokens`;
  const query = await db.collection(path).where("shuffleId", "==", shuffleId).get();
  const docs = query.docs;
  const result = docs.length > 0;
  return result;
}
