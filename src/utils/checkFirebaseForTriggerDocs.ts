import * as admin from "firebase-admin";

export const checkFirebaseForTriggerDocs = async (db: admin.firestore.Firestore): Promise<unknown> => {
  const pathToCheck = `requests/splitters/tbDeployed`
  const results = await db.collection(pathToCheck).limit(1).get();
  const docs = results.docs;
  if (docs && docs.length > 0) {
    const doc = docs[0];
    const data = doc.data();
    return data;
  } else {
    return undefined;
  }
}

export const checkSaleSplitterToBeDeployed = async (db: admin.firestore.Firestore): Promise<unknown> => {
  const pathToCheck = `requests/splitters/tbDeployedSale`
  return _getDocFromFb(pathToCheck, db);
}
export const checkRoyaltySplitterToBeDeployed = async (db: admin.firestore.Firestore): Promise<unknown> => {
  const pathToCheck = `requests/splitters/tbDeployedRoyalty`
  return _getDocFromFb(pathToCheck, db);
}
export const checkGeneratorsToBeMinted = async (db: admin.firestore.Firestore): Promise<unknown> => {
  const pathToCheck = `requests/mintGen/tbMintedGen`
  return _getTBMintedDocFromFb(pathToCheck, db);
}
export const checkNewCollectionsToBeDeployed = async (db: admin.firestore.Firestore): Promise<unknown> => {
  const pathToCheck = `requests/deployCollection/tbDeployedCollection`
  return _getDocFromFb(pathToCheck, db);
}
export const checkCollectionsToBeRegisteredDB = async (db: admin.firestore.Firestore): Promise<unknown> => {
  const pathToCheck = `requests/registerCollection/tbRegistered`
  return _getCollectionsToBeRegisteredDocFromFb(pathToCheck, db);
}



const _getDocFromFb = async (path: string, db: admin.firestore.Firestore): Promise<unknown> => {
  const results = await db.collection(path).limit(1).get();
  const docs = results.docs;
  if (docs && docs.length > 0) {
    const doc = docs[0];
    const data = doc.data();
    return data;
  } else {
    return undefined;
  }
}

const _getCollectionsToBeRegisteredDocFromFb = async (path: string, db: admin.firestore.Firestore): Promise<unknown> => {
  const results = await db.collection(path).where("isRegistered", "==", false).limit(1).get();
  const docs = results.docs;
  if (docs && docs.length > 0) {
    const doc = docs[0];
    const data = doc.data();
    return data;
  } else {
    return undefined;
  }
}


const _getTBMintedDocFromFb = async (path: string, db: admin.firestore.Firestore): Promise<unknown> => {
  const results = await db.collection(path).where("isMinted", "==", false).limit(1).get();
  const docs = results.docs;
  if (docs && docs.length > 0) {
    const doc = docs[0];
    const data = doc.data();
    return data;
  } else {
    return undefined;
  }
}