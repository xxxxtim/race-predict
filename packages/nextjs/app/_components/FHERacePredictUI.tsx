"use client";

import { useMemo, useState } from "react";
import { useFhevm } from "@fhevm-sdk";
import { motion } from "framer-motion";
import { useAccount } from "wagmi";
import { RainbowKitCustomConnectButton } from "~~/components/helper/RainbowKitCustomConnectButton";
import { useFHERacePredict } from "~~/hooks/useFHERacePredict";

export const FHERacePredictUI = () => {
  const { isConnected, chain } = useAccount();
  const activeChain = chain?.id;

  const ethProvider = useMemo(() => (typeof window !== "undefined" ? (window as any).ethereum : undefined), []);

  const demoChains = {
    11155111: `https://eth-sepolia.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`,
  };

  const { instance: raceVM } = useFhevm({
    provider: ethProvider,
    chainId: activeChain,
    initialMockChains: demoChains,
    enabled: true,
  });

  const race = useFHERacePredict({
    instance: raceVM,
    initialMockChains: demoChains,
  });

  const [selectedCar, setSelectedCar] = useState<number | null>(null);
  const [isRacing, setIsRacing] = useState(false);
  const [winner, setWinner] = useState<number | null>(null);
  const [resultMsg, setResultMsg] = useState("");
  const [raceRunKey, setRaceRunKey] = useState(0);
  const [showWinner, setShowWinner] = useState(false);

  const cars = [
    { id: 1, emoji: "🚗", color: "#f87171", label: "Red Fury" },
    { id: 2, emoji: "🏎️", color: "#60a5fa", label: "Blue Lightning" },
    { id: 3, emoji: "🚙", color: "#4ade80", label: "Green Titan" },
    { id: 4, emoji: "🚘", color: "#facc15", label: "Golden Jet" },
  ];

  const startRace = async () => {
    if (selectedCar === null || isRacing) return;

    setIsRacing(true);
    setWinner(null);
    setResultMsg("");
    setRaceRunKey(prev => prev + 1);

    // Chọn winner trước
    const randomWinner = cars[Math.floor(Math.random() * cars.length)].id;
    setWinner(randomWinner);

    // Set duration cho các xe: winner chạy nhanh nhất
    const durations = cars.map(car => (car.id === randomWinner ? 4.0 : 4.0 + Math.random() * 2.0));
    const maxDurationMs = Math.max(...durations) * 1000;

    setTimeout(async () => {
      setShowWinner(true)
      const didWin = Number(selectedCar === randomWinner);
      setResultMsg(didWin ? "🎉 You Win!" : `😢 You Lose! Winner: ${cars.find(c => c.id === randomWinner)?.label}`);

      try {
        if (typeof race.submitInfo === "function") {
          await race.submitInfo(Number(`${selectedCar}${didWin}`));
        }
        await race.refreshHistory?.();
        setWinner(null);
        setSelectedCar(null);
      } catch (err) {
        console.error("submitInfo failed:", err);
      } finally {
        setIsRacing(false);
        setShowWinner(false)
      }
    }, maxDurationMs + 200);

    // Lưu durations để dùng cho animation
    setCarDurations(durations);
  };

  const [carDurations, setCarDurations] = useState<number[]>([]);

  const handleDecryptHistory = async () => {
    if (race.isDecryptingHistory || (race.historyData?.length ?? 0) === 0) return;
    await race.decryptHistory?.();
  };

  if (!isConnected) {
    return (
      <div className="h-[calc(100vh-100px)] w-full flex items-center justify-center text-white">
        <motion.div
          className="h-[380px] w-[540px] bg-black/40 border border-cyan-400 rounded-2xl p-12 text-center shadow-xl backdrop-blur-md"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
        >
          <div className="text-7xl mb-6 animate-pulse">🏁</div>
          <h2 className="text-3xl font-extrabold mb-3 tracking-wide">Connect Wallet</h2>
          <p className="text-gray-300 mb-6">Access the FHE Race Prediction dApp</p>
          <RainbowKitCustomConnectButton />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-100px)] w-full from-gray-900 text-white">
      <div className="max-w-[1400px] mx-auto px-6 py-10">
        <header className="flex items-center justify-between mb-8">
          <h1 className="text-4xl font-extrabold text-cyan-400">🏁 FHE Race Predict</h1>
        </header>

        {/* === Race Track === */}
        <section className="mb-8">
          <div className="bg-gray-900 border border-cyan-700 rounded-2xl p-6 shadow-lg">
            <h2 className="text-xl font-semibold mb-4">Race Track</h2>
            <div className="relative h-56 w-full bg-gradient-to-r from-gray-800 to-gray-900 rounded-xl overflow-hidden border border-gray-800">
              {cars.map((car, i) => {
                const duration = carDurations[i] ?? 4 + ((raceRunKey + i) % 3) * 0.7 + i * 0.15;
                return (
                  <motion.div
                    key={`${raceRunKey}-${car.id}`}
                    className="absolute flex items-center gap-3 text-lg font-semibold"
                    style={{ top: `${i * 25 + 7}%`, left: 20, color: car.color }}
                    initial={{ x: 0 }}
                    animate={isRacing ? { x: 1080 } : winner === car.id ? { x: 1080 } : { x: 0 }}
                    transition={{ duration: isRacing ? duration : 0.6, ease: "easeInOut" }}
                  >
                    <span className="text-3xl" style={{ transform: "rotateY(180deg)" }}>
                      {car.emoji}
                    </span>
                    <span>{car.label}</span>
                  </motion.div>
                );
              })}
            </div>

            <div className="mt-4 min-h-[32px] text-lg">
              {winner !== null && showWinner ? (
                <div className="inline-flex items-center gap-2 bg-black/40 border border-cyan-600 px-4 py-2 rounded-full">
                  <span>🏆 Winner:</span>
                  <span className="text-cyan-300 font-bold">{cars.find(c => c.id === winner)?.label}</span>
                </div>
              ) : (
                <span className="text-gray-400">No race run yet.</span>
              )}
            </div>
          </div>
        </section>

        {/* === Control Panel === */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* === Your Prediction === */}
          <div className="bg-gray-900 border border-cyan-700 rounded-2xl p-6 shadow">
            <h3 className="text-lg font-semibold mb-4">Your Prediction</h3>
            <div className="grid grid-cols-2 gap-3">
              {cars.map(car => (
                <button
                  key={car.id}
                  onClick={() => setSelectedCar(car.id)}
                  disabled={isRacing || race.isProcessing}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg border transition ${
                    selectedCar === car.id
                      ? "bg-cyan-500 text-black border-cyan-400"
                      : "border-gray-700 hover:border-cyan-400"
                  } ${isRacing ? "opacity-60 cursor-not-allowed" : ""}`}
                >
                  <span className="text-2xl" style={{ transform: "rotateY(180deg)" }}>{car.emoji}</span>
                  <div className="text-sm font-medium">{car.label}</div>
                </button>
              ))}
            </div>

            <button
              onClick={startRace}
              disabled={selectedCar === null || isRacing || race.isProcessing}
              className={`mt-5 w-full px-4 py-3 rounded-xl font-bold text-lg transition ${
                selectedCar === null || isRacing || race.isProcessing
                  ? "bg-gray-700 text-gray-300 cursor-not-allowed"
                  : "bg-pink-500 hover:bg-pink-400 text-black"
              }`}
            >
              {isRacing ? "🏎️ Racing..." : "Start Race"}
            </button>

            <div className="mt-4 text-sm text-gray-300">
              <div>
                Selected:{" "}
                {selectedCar === null ? "—" : `${selectedCar} • ${cars.find(c => c.id === selectedCar)?.label}`}
              </div>
              <div className="mt-2">{resultMsg}</div>
            </div>
          </div>

          {/* === Decrypt & History === */}
          <div className="p-4 bg-black/20 rounded-lg bg-gray-900 border border-cyan-700">
            <h4 className="font-medium mb-3 flex items-center justify-between">
              <span>Decrypt & History</span>
              <button
                onClick={handleDecryptHistory}
                disabled={race.isDecryptingHistory || (race.historyData?.length ?? 0) === 0}
                className={`px-3 py-1.5 rounded-md border border-cyan-400 text-cyan-300 hover:bg-cyan-500 hover:text-black text-sm transition ${
                  race.isDecryptingHistory || (race.historyData?.length ?? 0) === 0
                    ? "opacity-60 cursor-not-allowed"
                    : ""
                }`}
              >
                🔓 {race.isDecryptingHistory ? "Decrypting..." : "Decrypt"}
              </button>
            </h4>

            <div className="overflow-y-auto rounded-lg border border-gray-800 divide-y divide-gray-800">
              {/* Header row */}
              <div className="grid grid-cols-2 text-sm text-gray-400 bg-gray-800/50 font-semibold px-3 py-2">
                <div>On-chain (raw)</div>
                <div className="ml-10">Decrypted result</div>
              </div>

              {/* History items */}
              {(race.historyData ?? []).map((item: string, idx: number) => {
                const decrypted = race.historyResults?.[item]; // key là item

                let decryptedView;

                if (decrypted === undefined) {
                  decryptedView = (
                    <div className="flex items-center gap-2 text-gray-500 ml-10">
                      <span className="text-lg">🔒</span>
                      <span className="italic">Encrypted</span>
                    </div>
                  );
                } else {
                  // parse BigInt value
                  const value = Number(decrypted); // ví dụ 10n -> 10
                  const carId = Math.floor(value / 10); // tùy logic encode của bạn
                  const result = value % 10; // tùy logic encode
                  const car = cars.find(c => c.id === carId);
                  const isWin = result === 1;

                  decryptedView = (
                    <div className="flex items-center justify-between text-sm ml-10">
                      <div className="flex items-center gap-2">
                        {car ? (
                          <>
                            <span className="text-xl">{car.emoji}</span>
                            <span className="text-cyan-400 font-bold">{car.label}</span>
                          </>
                        ) : (
                          <>Car #{carId}</>
                        )}
                      </div>
                      <span className={`font-semibold ${isWin ? "text-green-400" : "text-red-400"}`}>
                        {isWin ? "WIN 🏆" : "LOSE 💀"}
                      </span>
                    </div>
                  );
                }

                return (
                  <div
                    key={idx}
                    className="grid grid-cols-2 items-center px-3 py-2 text-sm hover:bg-gray-800/30 transition-colors"
                  >
                    {/* Left: raw */}
                    <div className="truncate text-gray-300 font-mono flex items-center gap-2">
                      <span className="text-gray-500">#{idx + 1}</span>
                      <span className="truncate">{item}</span>
                    </div>

                    {/* Right: decrypted or locked */}
                    {decryptedView}
                  </div>
                );
              })}

              {(!race.historyData || race.historyData.length === 0) && (
                <div className="text-gray-500 italic text-center py-6 text-sm">No on-chain data yet.</div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
