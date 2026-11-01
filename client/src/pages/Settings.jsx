import React, { useEffect, useRef, useState } from "react";
import { Download, HardDrive, Upload } from "lucide-react";
import { api, downloadBackup } from "../lib/api.js";
export default function Settings({
  theme,
  setTheme,
  displayName,
  userName,
  onDisplayNameChange,
}) {
  const [file, setFile] = useState(null),
    [msg, setMsg] = useState(""),
    [name, setName] = useState(displayName || userName);
  const input = useRef();
  useEffect(() => {
    setName(displayName || userName);
  }, [displayName, userName]);
  const themeSave = async (t) => {
    try {
      await api.put("/api/settings", { theme: t });
      setTheme(t);
      setMsg("");
    } catch (e) {
      setMsg(e.message);
    }
  };
  const saveName = async (e) => {
    e.preventDefault();
    const value = name.trim();
    if (!value) {
      setMsg("Enter a name to personalize your finance tracker.");
      return;
    }
    try {
      const settings = await api.put("/api/settings", { displayName: value });
      onDisplayNameChange(settings.displayName);
      setMsg("Your finance tracker name has been saved.");
    } catch (error) {
      setMsg(error.message);
    }
  };
  const localSave = async () => {
    try {
      await downloadBackup();
      setMsg("Backup exported to your laptop.");
    } catch (e) {
      setMsg(e.message);
    }
  };
  const importData = async () => {
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      await api.post("/api/backup/import", data);
      setMsg("Backup restored. Reload the app to see everything.");
    } catch (e) {
      setMsg(e.message);
    }
  };
  return (
    <>
      <div className="page-actions">
        <div>
          <span className="muted">Personal app settings</span>
        </div>
      </div>
      <div className="settings-stack">
        <section className="panel">
          <div className="panel-head">
            <h2>Your finance tracker</h2>
          </div>
          <form className="setting-row name-setting" onSubmit={saveName}>
            <div>
              <strong>Display name</strong>
              <span className="muted">
                Your private workspace will be called “{name.trim() || "Your name"}’s Finance”.
              </span>
            </div>
            <input
              aria-label="Your display name"
              maxLength={40}
              onChange={(event) => setName(event.target.value)}
              placeholder="Your name"
              required
              value={name}
            />
            <button className="btn primary" type="submit">
              Save name
            </button>
          </form>
        </section>
        <section className="panel">
          <div className="panel-head">
            <h2>Appearance</h2>
          </div>
          <div className="setting-row">
            <div>
              <strong>Theme</strong>
              <span className="muted">Minimal light/dark interface</span>
            </div>
            <div className="segmented compact">
              {["light", "dark", "system"].map((t) => (
                <button
                  key={t}
                  className={theme === t ? "selected" : ""}
                  onClick={() => themeSave(t)}
                >
                  {t[0].toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div className="setting-row">
            <div>
              <strong>Base currency</strong>
              <span className="muted">Fixed for this personal tracker</span>
            </div>
            <span className="badge">₹ INR</span>
          </div>
        </section>
        <section className="panel">
          <div className="panel-head">
            <h2>Backup & restore</h2>
          </div>
          <div className="backup-box">
            <div className="backup-icon">
              <HardDrive size={20} />
            </div>
            <div>
              <strong>Keep a copy on your laptop</strong>
              <span className="muted">
                Export all accounts, transactions, budgets, goals, funds,
                recurring rules and settings as JSON.
              </span>
            </div>
            <button className="btn" onClick={localSave}>
              <Download size={16} /> Export
            </button>
          </div>
          <div className="backup-box">
            <div className="backup-icon">
              <Upload size={20} />
            </div>
            <div>
              <strong>Restore a backup</strong>
              <span className="muted">
                Importing replaces current database data with the selected
                backup.
              </span>
            </div>
            <input
              ref={input}
              className="hidden"
              type="file"
              accept="application/json"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
            <button className="btn" onClick={() => input.current?.click()}>
              Choose file
            </button>
            {file && (
              <button className="btn primary" onClick={importData}>
                Restore
              </button>
            )}
          </div>
          {msg && <div className="notice">{msg}</div>}
        </section>
        <section className="panel">
          <div className="panel-head">
            <h2>Data model</h2>
          </div>
          <div className="muted settings-copy">
            Your account is protected by secure sign-in. Your financial records
            and backups are scoped to your account and are not visible to other
            users. MongoDB stores live data; JSON backups give you a portable
            copy.
          </div>
        </section>
      </div>
    </>
  );
}
