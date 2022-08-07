import * as admin from "firebase-admin";

export const getPlatformSettingsData = async (chainId: number, db: admin.firestore.Firestore, uid: string): Promise<Record<string, unknown>> => {
  const doc = await db.collection("settings").doc(`chain_${chainId.toString()}`).get();
  if (doc.exists) {
    const data = doc.data();
    if (data) {
      return data;
    } else {
      return {}
    }
  } else {
    return {}
  }
}