"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { OnboardingFlow } from "@/app/components/OnboardingFlow";
import { api, Settings, SettingsUpdate } from "@/lib/api";

const DEFAULT_SETTINGS: SettingsUpdate = {
  root_path: "",
  scan_interval: 60,
  auto_scan: true,
  backup_retention: 10,
  theme: "system",
  onboarding_completed: false,
};

export default function OnboardingPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getSettings()
      .then(setSettings)
      .catch(() => setError("无法加载当前设置，请确认本地服务正在运行。"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="onboarding-screen"><span className="spinner" /> 加载首次设置...</div>;
  if (error) return <div className="onboarding-screen"><div className="notice error">{error}</div></div>;

  const initialSettings: SettingsUpdate = settings ? {
    root_path: settings.root_path,
    scan_interval: settings.scan_interval,
    auto_scan: settings.auto_scan,
    backup_retention: settings.backup_retention,
    theme: settings.theme,
    onboarding_completed: settings.onboarding_completed,
  } : DEFAULT_SETTINGS;

  return <div className="onboarding-screen">
    <OnboardingFlow
      initialSettings={initialSettings}
      onCancel={settings?.onboarding_completed ? () => router.back() : undefined}
      onSettingsSaved={setSettings}
      onComplete={() => router.replace("/")}
    />
  </div>;
}
