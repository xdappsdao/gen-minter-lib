import { ethers } from "ethers";
import * as admin from "firebase-admin";
const fs = require('fs');
const SA = process.env.SERVICE_ACCOUNT ? process.env.SERVICE_ACCOUNT : '';
const SPLITTER_ABI = JSON.parse(fs.readFileSync("src/contracts/build/SplitRoyalty_sol_SplitRoyalty.abi"));
const splitter_bytecode = fs.readFileSync("src/contracts/build/SplitRoyalty_sol_SplitRoyalty.bin").toString();

export class CheckProjectsToBeSetup {
  db: admin.firestore.Firestore;

  constructor(db: admin.firestore.Firestore) {
    this.db = db;
  }

  async checkProjects(): Promise<unknown> {
    const pathToGet = `genTracking/approvals/pendingSetup`;
    const query = await this.db.collection(pathToGet).where("setupStarted", "==", false).get();
    const docs = query.docs;
    for (let i = 0; i < docs.length; i++) {
      const doc = docs[i];
      const data = doc.data();
      await this._setupProject(data);
    }
    return;
  }

  async _setupProject(projectToSetup: Record<string, unknown>): Promise<unknown> {
    await this._saveSetupStarted(projectToSetup.uid as string);
    await this._saveRoyaltySplitterDeployRequest(projectToSetup);
    return;
  }

  async _saveSetupStarted(uid: string): Promise<unknown> {
    const pathToUpdate = `genTracking/approvals/pendingSetup/${uid}`;
    const dataToUpdate = { setupStarted: true };
    return await this.db.doc(pathToUpdate).update(dataToUpdate);
  }
  async _saveRoyaltySplitterDeployRequest(contractToSetup: Record<string, unknown>): Promise<unknown> {
    const chainId = contractToSetup.chainId as number;
    const uid = contractToSetup.uid as string;
    const settings = await this._getSettingsData(chainId);
    const projectData = await this._getProjectData(contractToSetup.uid as string);
    const creatorRoyaltyAddress = projectData.creatorRoyaltyAddress as string;
    const creatorRoyaltyFactor = projectData.creatorRoyaltyFactory as number;
    const platformRoyaltyAddress = settings.platformRoyaltyAddress as string;
    const platformRoyaltyFactor = settings.platformRoyaltyFactor as number;
    const dataToSave = {
      chainId: chainId,
      uid: uid,
      creatorRoyaltyAddress: creatorRoyaltyAddress,
      creatorRoyaltyFactor: creatorRoyaltyFactor,
      platformRoyaltyAddress: platformRoyaltyAddress,
      platformRoyaltyFactor: platformRoyaltyFactor,
    };
    const pathToSave = `requests/splitters/tbDeployedRoyalty/${uid}`;
    return await this.db.doc(pathToSave).set(dataToSave);
  }

  async _getSettingsData(chainId: number): Promise<Record<string, unknown>> {
    const settingsPath = `settings/chain_${chainId.toString()}`;
    const settingsQuery = await this.db.doc(settingsPath).get();
    const settingsData = settingsQuery.data();
    return settingsData;
  }
  async _getProjectData(uid: string): Promise<Record<string, unknown>> {
    const projectPath = `genTracking/approvals/pendingSetup/${uid}`;
    const projectDoc = await this.db.doc(projectPath).get();
    return projectDoc.data();
  }

}