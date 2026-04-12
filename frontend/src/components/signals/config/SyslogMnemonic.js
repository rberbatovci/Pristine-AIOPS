import React, { useState, useEffect } from "react";
import Select from "react-select";
import customStyles from "../../misc/SelectStyles";
//import "./SignalConfigElement.css";

import { useMnemonics } from "../../../hooks/useMnemonics";
import { useSyslogTags } from "../../../hooks/useSyslogTags";
import { useMnemonicDetails } from "../../../hooks/useMnemonicDetails";

const SyslogMnemonicUpdater = ({ keycloak }) => {
  const { mnemonics, loading: mnemonicsLoading } = useMnemonics(keycloak);
  const { tags } = useSyslogTags(keycloak, false);
  const {
    details,
    loading: detailsLoading,
    loadMnemonic,
    updateMnemonic
  } = useMnemonicDetails(keycloak);

  const [selectedMnemonic, setSelectedMnemonic] = useState(null);
  const [description, setDescription] = useState("");
  const [createSignal, setCreateSignal] = useState(false);
  const [muteSignal, setMuteSignal] = useState(false);
  const [warmUp, setWarmUp] = useState("");
  const [coolDown, setCoolDown] = useState("");
  const [selectedTags, setSelectedTags] = useState([]);

  /** Load mnemonic details into form */
  useEffect(() => {
    if (!details) return;

    setDescription(details.description || "");
    setCreateSignal(details.create_signal || false);
    setWarmUp(details.warm_up !== null ? String(details.warm_up) : "");
    setCoolDown(details.cool_down !== null ? String(details.cool_down) : "");
    setSelectedTags(
      (details.tags || []).map(tag => ({
        value: tag,
        label: tag
      }))
    );
  }, [details]);

  const handleMnemonicClick = (mnemonic) => {
    setSelectedMnemonic(mnemonic);
    loadMnemonic(mnemonic.id);
  };

  const handleSubmit = async () => {
    if (!selectedMnemonic) return;

    await updateMnemonic(selectedMnemonic.id, {
      description,
      create_signal: createSignal,
      warm_up: warmUp ? parseInt(warmUp, 10) : null,
      cool_down: coolDown ? parseInt(coolDown, 10) : null,
      tags: selectedTags.map(t => t.value)
    });
  };

  if (mnemonicsLoading || detailsLoading) {
    return <div className="signalConfigRuleMessage">Loading…</div>;
  }

  return (
    <div className="signalConfigRuleContainer">
      <div className="signalConfigRuleContent">
        <div className="signalConfigRulesList" style={{ height: 320 }}>
          <ul>
            {mnemonics.map(mnemonic => (
              <li
                key={mnemonic.id}
                className={`button ${
                  selectedMnemonic?.id === mnemonic.id
                    ? "button-active"
                    : ""
                }`}
                onClick={() => handleMnemonicClick(mnemonic)}
              >
                {mnemonic.name}
              </li>
            ))}
          </ul>
        </div>

        <div style={{ width: "75%", margin: 10 }}>
          <div style={{ marginBottom: 20 }}>
            Syslog Mnemonic: <strong>{details?.name}</strong>
          </div>

          <label>
            <input
              type="checkbox"
              checked={createSignal}
              onChange={e => setCreateSignal(e.target.checked)}
            />
            Create Signal
          </label>

          <Select
            isMulti
            styles={customStyles}
            options={tags}
            value={selectedTags}
            onMenuOpen={() => {}}
            onChange={setSelectedTags}
          />

          <input
            type="number"
            value={warmUp}
            onChange={e => setWarmUp(e.target.value)}
            placeholder="Warm up (seconds)"
          />

          <input
            type="number"
            value={coolDown}
            onChange={e => setCoolDown(e.target.value)}
            placeholder="Cool down (seconds)"
          />

          <input
            type="text"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Description"
          />
        </div>
      </div>

      <div className="signalConfigButtonContainer">
        <button onClick={handleSubmit} className="update-button">
          Update Mnemonic
        </button>
      </div>
    </div>
  );
};

export default SyslogMnemonicUpdater;
