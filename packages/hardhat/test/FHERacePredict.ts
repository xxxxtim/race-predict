import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
import { FHERacePredict, FHERacePredict__factory } from "../types";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";

type Accounts = {
  owner: HardhatEthersSigner;
  participantA: HardhatEthersSigner;
  participantB: HardhatEthersSigner;
};

async function deployRacePredict() {
  const factory = (await ethers.getContractFactory("FHERacePredict")) as FHERacePredict__factory;
  const instance = (await factory.deploy()) as FHERacePredict;
  const address = await instance.getAddress();
  return { instance, address };
}

describe("🔒 FHERacePredict - Encrypted Race Data", function () {
  let acc: Accounts;
  let race: FHERacePredict;
  let raceAddr: string;

  before(async () => {
    const [owner, p1, p2] = await ethers.getSigners();
    acc = { owner, participantA: p1, participantB: p2 };
  });

  beforeEach(async function () {
    if (!fhevm.isMock) {
      console.warn("🚫 Tests require local FHEVM mock mode to run");
      this.skip();
    }
    ({ instance: race, address: raceAddr } = await deployRacePredict());
  });

  it("starts with empty record history for new participant", async () => {
    const record = await race.getInfoHistory(acc.participantA.address);
    expect(record.length).to.eq(0);
  });

  it("stores an encrypted race entry and allows owner decryption", async () => {
    const enc = await fhevm.createEncryptedInput(raceAddr, acc.participantA.address).add32(7777).encrypt();
    const tx = await race.connect(acc.participantA).submitInfo(enc.handles[0], enc.inputProof);
    await tx.wait();

    const stored = await race.getInfoHistory(acc.participantA.address);
    expect(stored.length).to.eq(1);

    const decrypted = await fhevm.userDecryptEuint(FhevmType.euint32, stored[0], raceAddr, acc.participantA);
    expect(decrypted).to.eq(7777);
  });

  it("records multiple encrypted predictions in correct order", async () => {
    const predictionValues = [12, 25, 48, 73];
    for (const value of predictionValues) {
      const encrypted = await fhevm.createEncryptedInput(raceAddr, acc.participantA.address).add32(value).encrypt();
      await (await race.connect(acc.participantA).submitInfo(encrypted.handles[0], encrypted.inputProof)).wait();
      await ethers.provider.send("evm_mine", []); // separate blocks
    }

    const entries = await race.getInfoHistory(acc.participantA.address);
    expect(entries.length).to.eq(predictionValues.length);

    for (let i = 0; i < entries.length; i++) {
      const clear = await fhevm.userDecryptEuint(FhevmType.euint32, entries[i], raceAddr, acc.participantA);
      expect(clear).to.eq(predictionValues[i]);
    }
  });

  it("keeps participant data isolated and private between users", async () => {
    const encA = await fhevm.createEncryptedInput(raceAddr, acc.participantA.address).add32(88).encrypt();
    await race.connect(acc.participantA).submitInfo(encA.handles[0], encA.inputProof);

    const encB = await fhevm.createEncryptedInput(raceAddr, acc.participantB.address).add32(222).encrypt();
    await race.connect(acc.participantB).submitInfo(encB.handles[0], encB.inputProof);

    const histA = await race.getInfoHistory(acc.participantA.address);
    const histB = await race.getInfoHistory(acc.participantB.address);

    expect(histA.length).to.eq(1);
    expect(histB.length).to.eq(1);

    const valA = await fhevm.userDecryptEuint(FhevmType.euint32, histA[0], raceAddr, acc.participantA);
    const valB = await fhevm.userDecryptEuint(FhevmType.euint32, histB[0], raceAddr, acc.participantB);

    expect(valA).to.eq(88);
    expect(valB).to.eq(222);
  });

  it("handles identical encrypted submissions from the same user", async () => {
    const identical = [555, 555];
    for (const v of identical) {
      const enc = await fhevm.createEncryptedInput(raceAddr, acc.participantA.address).add32(v).encrypt();
      await (await race.connect(acc.participantA).submitInfo(enc.handles[0], enc.inputProof)).wait();
    }

    const history = await race.getInfoHistory(acc.participantA.address);
    expect(history.length).to.eq(2);

    for (const h of history) {
      const dec = await fhevm.userDecryptEuint(FhevmType.euint32, h, raceAddr, acc.participantA);
      expect(dec).to.eq(555);
    }
  });

  it("supports maximum 32-bit encrypted values", async () => {
    const maxUint32 = 2 ** 32 - 1;
    const enc = await fhevm.createEncryptedInput(raceAddr, acc.participantA.address).add32(maxUint32).encrypt();
    await (await race.connect(acc.participantA).submitInfo(enc.handles[0], enc.inputProof)).wait();

    const list = await race.getInfoHistory(acc.participantA.address);
    const val = await fhevm.userDecryptEuint(FhevmType.euint32, list[0], raceAddr, acc.participantA);
    expect(val).to.eq(maxUint32);
  });

  it("maintains consistent insertion sequence across many entries", async () => {
    const dataset = [7, 17, 27, 37, 47, 57];
    for (const num of dataset) {
      const enc = await fhevm.createEncryptedInput(raceAddr, acc.participantA.address).add32(num).encrypt();
      await (await race.connect(acc.participantA).submitInfo(enc.handles[0], enc.inputProof)).wait();
    }

    const all = await race.getInfoHistory(acc.participantA.address);
    expect(all.length).to.eq(dataset.length);

    const first = await fhevm.userDecryptEuint(FhevmType.euint32, all[0], raceAddr, acc.participantA);
    const last = await fhevm.userDecryptEuint(FhevmType.euint32, all[all.length - 1], raceAddr, acc.participantA);

    expect(first).to.eq(dataset[0]);
    expect(last).to.eq(dataset[dataset.length - 1]);
  });

  it("allows back-to-back encrypted submissions without issue", async () => {
    const quickInputs = [42, 43, 44];
    for (const n of quickInputs) {
      const enc = await fhevm.createEncryptedInput(raceAddr, acc.participantA.address).add32(n).encrypt();
      await race.connect(acc.participantA).submitInfo(enc.handles[0], enc.inputProof);
    }

    const stored = await race.getInfoHistory(acc.participantA.address);
    expect(stored.length).to.eq(quickInputs.length);

    const lastVal = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      stored[stored.length - 1],
      raceAddr,
      acc.participantA,
    );
    expect(lastVal).to.eq(44);
  });
});
