import { useEffect } from "react";
import { TopBar } from "./components/TopBar";
import { SafetyBanner } from "./components/SafetyBanner";
import { SafetyModal } from "./components/SafetyModal";
import { Dashboard } from "./components/Dashboard";
import { MetricsScreen } from "./components/MetricsScreen";
import { DocsScreen } from "./components/DocsScreen";
import { useRiskStore } from "./lib/store";
import { api } from "./lib/api";

export default function App() {
  const screen = useRiskStore((s) => s.screen);
  const openSafety = useRiskStore((s) => s.openSafety);
  const loadPresets = useRiskStore((s) => s.loadPresets);
  const setModelHash = useRiskStore((s) => s.setModelHash);

  useEffect(() => {
    void loadPresets();
    api
      .health()
      .then((h) => setModelHash(h.model_hash))
      .catch(() => setModelHash(null));
  }, [loadPresets, setModelHash]);

  return (
    <div className="flex h-full min-h-screen flex-col bg-canvas">
      <TopBar />
      <SafetyBanner onOpen={openSafety} />
      <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {screen === "dashboard" ? <Dashboard /> : null}
        {screen === "metrics" ? (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <MetricsScreen />
          </div>
        ) : null}
        {screen === "docs" ? (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <DocsScreen />
          </div>
        ) : null}
      </main>
      <SafetyModal />
    </div>
  );
}