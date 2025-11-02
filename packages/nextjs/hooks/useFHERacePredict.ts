"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useDeployedContractInfo } from "./helper";
import { useWagmiEthers } from "./wagmi/useWagmiEthers";
import { FhevmInstance } from "@fhevm-sdk";
import {
  buildParamsFromAbi,
  getEncryptionMethod,
  useFHEDecrypt,
  useFHEEncryption,
  useInMemoryStorage,
} from "@fhevm-sdk";
import { ethers } from "ethers";
import { useReadContract } from "wagmi";
import type { Contract } from "~~/utils/helper/contract";
import type { AllowedChainIds } from "~~/utils/helper/networks";

/**
 * @hook useFHERacePredict
 * @notice Custom React hook to interact with the FHERacePredict smart contract.
 *         Handles encryption, submission, and decryption of encrypted user data.
 */
export const useFHERacePredict = (args: {
  instance: FhevmInstance | undefined;
  initialMockChains?: Readonly<Record<number, string>>;
}) => {
  const { instance, initialMockChains } = args;
  const { storage: decSigStore } = useInMemoryStorage();
  const { chainId, accounts, isConnected, ethersReadonlyProvider, ethersSigner } = useWagmiEthers(initialMockChains);

  const activeChain = typeof chainId === "number" ? (chainId as AllowedChainIds) : undefined;
  const { data: raceContract } = useDeployedContractInfo({
    contractName: "FHERacePredict",
    chainId: activeChain,
  });

  type RaceContractInfo = Contract<"FHERacePredict"> & { chainId?: number };

  const [statusMsg, setStatusMsg] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  const hasContract = Boolean(raceContract?.address && raceContract?.abi);
  const hasSigner = Boolean(ethersSigner);
  const hasProvider = Boolean(ethersReadonlyProvider);

  const getRaceContract = (mode: "read" | "write") => {
    if (!hasContract) return undefined;
    const provOrSigner = mode === "read" ? ethersReadonlyProvider : ethersSigner;
    if (!provOrSigner) return undefined;
    return new ethers.Contract(raceContract!.address, (raceContract as RaceContractInfo).abi, provOrSigner);
  };

  // Fetch encrypted info history for user
  const { data: historyData, refetch: refreshHistory } = useReadContract({
    address: hasContract ? (raceContract!.address as `0x${string}`) : undefined,
    abi: hasContract ? ((raceContract as RaceContractInfo).abi as any) : undefined,
    functionName: "getInfoHistory",
    args: [accounts ? accounts[0] : ""],
    query: { enabled: Boolean(hasContract && hasProvider), refetchOnWindowFocus: false },
  });

  // Prepare decryption requests
  const historyDecryptRequests = useMemo(() => {
    if (!historyData || !Array.isArray(historyData)) return undefined;
    return historyData.map(item => ({
      handle: item,
      contractAddress: raceContract!.address,
    }));
  }, [historyData, raceContract?.address]);

  // Decryption hook
  const {
    canDecrypt: canDecryptHistory,
    decrypt: decryptHistory,
    isDecrypting: isDecryptingHistory,
    message: historyDecMsg,
    results: historyResults,
  } = useFHEDecrypt({
    instance,
    ethersSigner: ethersSigner as any,
    fhevmDecryptionSignatureStorage: decSigStore,
    chainId,
    requests: historyDecryptRequests,
  });

  useEffect(() => {
    if (historyDecMsg) setStatusMsg(historyDecMsg);
  }, [historyDecMsg]);

  // Encryption hook
  const { encryptWith } = useFHEEncryption({
    instance,
    ethersSigner: ethersSigner as any,
    contractAddress: raceContract?.address,
  });

  const canSubmit = useMemo(
    () => Boolean(hasContract && instance && hasSigner && !isBusy),
    [hasContract, instance, hasSigner, isBusy],
  );

  const getEncryptionMethodFor = (fnName: "submitInfo") => {
    const fnAbi = raceContract?.abi.find(item => item.type === "function" && item.name === fnName);
    if (!fnAbi) return { method: undefined as string | undefined, error: `No ABI for ${fnName}` };
    if (!fnAbi.inputs || fnAbi.inputs.length === 0)
      return { method: undefined as string | undefined, error: `No inputs for ${fnName}` };
    return { method: getEncryptionMethod(fnAbi.inputs[0].internalType), error: undefined };
  };

  // Submit encrypted info
  const submitInfo = useCallback(
    async (value: number) => {
      if (isBusy || !canSubmit) return;
      setIsBusy(true);
      setStatusMsg(`Submitting info (${value})...`);
      try {
        const { method, error } = getEncryptionMethodFor("submitInfo");
        if (!method) return setStatusMsg(error ?? "Encryption method missing");
        setStatusMsg(`Encrypting with ${method}...`);
        const encData = await encryptWith(builder => {
          (builder as any)[method](value);
        });
        if (!encData) return setStatusMsg("Encryption failed");
        const contractWrite = getRaceContract("write");
        if (!contractWrite) return setStatusMsg("Contract unavailable or signer missing");
        const params = buildParamsFromAbi(encData, [...raceContract!.abi] as any[], "submitInfo");
        const tx = await contractWrite.submitInfo(...params, { gasLimit: 300_000 });
        setStatusMsg("Waiting for transaction...");
        await tx.wait();
        setStatusMsg(`Info (${value}) submitted!`);
        await refreshHistory();
      } catch (e) {
        setStatusMsg(`submitInfo() failed: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        setIsBusy(false);
      }
    },
    [isBusy, canSubmit, encryptWith, getRaceContract, refreshHistory, raceContract?.abi],
  );

  useEffect(() => {
    setStatusMsg("");
  }, [accounts, chainId]);

  return {
    contractAddress: raceContract?.address,
    canDecryptHistory,
    decryptHistory,
    isDecryptingHistory,
    historyResults,
    historyData,
    refreshHistory,
    submitInfo,
    isProcessing: isBusy,
    canSubmit,
    chainId,
    accounts,
    isConnected,
    ethersSigner,
    message: statusMsg,
  };
};
