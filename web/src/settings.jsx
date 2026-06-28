import React, { useState, useEffect } from "react";
import { useI18n } from "./i18n.jsx";
import { fetchConfig, saveConfig, fetchServersConfig, saveServersConfig, fetchServerSettings, saveServerSettings, triggerRefresh } from "./api.js";
import "./styles/settings.css";

export function SettingsButton({ onOpen }) {
  const { t } = useI18n();
  return (
    <button className="icon-btn" title={t("settings.title") || "Settings"} onClick={onOpen}>
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7">
        <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    </button>
  );
}

export function SettingsModal({ open, onClose }) {
  const { t } = useI18n();
  const [configText, setConfigText] = useState("");
  const [serversText, setServersText] = useState("");
  const [settingsText, setSettingsText] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (open) {
      loadConfigs();
      setError("");
      setSuccess("");
    }
  }, [open]);

  async function loadConfigs() {
    setLoading(true);
    setError("");
    try {
      const [config, servers, settings] = await Promise.all([fetchConfig(), fetchServersConfig(), fetchServerSettings()]);
      setConfigText(JSON.stringify(config, null, 2));
      setServersText(JSON.stringify(servers, null, 2));
      setSettingsText(JSON.stringify(settings, null, 2));
    } catch (e) {
      setError("Failed to load configs: " + e.message);
    }
    setLoading(false);
  }

  async function handleSave() {
    setError("");
    setSuccess("");

    let config, servers, settings;
    try {
      config = JSON.parse(configText);
    } catch (e) {
      setError("config.json: " + e.message);
      return;
    }
    try {
      servers = JSON.parse(serversText);
    } catch (e) {
      setError("servers.json: " + e.message);
      return;
    }
    try {
      settings = JSON.parse(settingsText);
    } catch (e) {
      setError("server_settings.json: " + e.message);
      return;
    }

    setSaving(true);
    try {
      await Promise.all([saveConfig(config), saveServersConfig(servers), saveServerSettings(settings)]);
      setSuccess("Saved successfully!");
      triggerRefresh("all");
      setTimeout(() => onClose(), 1000);
    } catch (e) {
      setError("Failed to save: " + e.message);
    }
    setSaving(false);
  }

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{t("settings.title") || "Settings"}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        {loading ? (
          <div className="modal-body loading">Loading...</div>
        ) : (
          <div className="modal-body settings-body">
            <div className="settings-panel">
              <label className="settings-label">config.json</label>
              <textarea
                className="settings-editor"
                value={configText}
                onChange={(e) => setConfigText(e.target.value)}
                spellCheck={false}
              />
            </div>
            <div className="settings-panel">
              <label className="settings-label">servers.json</label>
              <textarea
                className="settings-editor"
                value={serversText}
                onChange={(e) => setServersText(e.target.value)}
                spellCheck={false}
              />
            </div>
            <div className="settings-panel">
              <label className="settings-label">server_settings.json</label>
              <textarea
                className="settings-editor"
                value={settingsText}
                onChange={(e) => setSettingsText(e.target.value)}
                spellCheck={false}
              />
            </div>
          </div>
        )}

        {error && <div className="settings-error">{error}</div>}
        {success && <div className="settings-success">{success}</div>}

        <div className="modal-footer">
          <button className="btn btn-cancel" onClick={onClose}>{t("settings.cancel") || "Cancel"}</button>
          <button className="btn btn-save" onClick={handleSave} disabled={saving || loading}>
            {saving ? "Saving..." : (t("settings.save") || "Save")}
          </button>
        </div>
      </div>
    </div>
  );
}
