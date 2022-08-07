
import * as admin from "firebase-admin";
export const getShuffleResultById = async (chainId: number, shuffleId: number, db: admin.firestore.Firestore): Promise<Record<string, unknown> | undefined> => {
  const resultPath = `genTracking/chain_${chainId.toString()}/shuffles/shuffleResults/shuffleResults/shuffleId_${shuffleId.toString()}`;
  const doc = await db.doc(resultPath).get();
  if (doc.exists) {
    return doc.data();
  } else {
    return undefined;
  }
}
