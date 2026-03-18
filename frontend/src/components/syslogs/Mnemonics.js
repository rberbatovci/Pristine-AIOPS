import React, { useState, useEffect, useMemo } from 'react';
import Select from 'react-select';
import customStyles from '../misc/SelectStyles';
import '../../css/SyslogTagsList.css';
import { TailSpin } from 'react-loader-spinner';

import { useSyslogRegEx } from '../../hooks/useSyslogRegEx';
import { useMnemonics } from '../../hooks/useMnemonics';
import { useMnemonicDetails } from '../../hooks/useMnemonicDetails';

function Mnemonics({ keycloak }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [success, setSuccess] = useState(false);

  // -----------------------------
  // Hooks
  // -----------------------------
  const {
    mnemonics,
    loading: listLoading,
    error: listError
  } = useMnemonics(keycloak);

  const {
    regExRules,
    loading: regexLoading,
    error: regexError
  } = useSyslogRegEx({ keycloak });

  const {
    details: selectedMnemonic,
    loading: detailsLoading,
    error: detailsError,
    loadMnemonic,
    updateMnemonic,
    deleteMnemonic
  } = useMnemonicDetails(keycloak);

  // -----------------------------
  // Auto-select random mnemonic
  // -----------------------------
  useEffect(() => {
    if (mnemonics.length && !selectedMnemonic) {
      const random = mnemonics[Math.floor(Math.random() * mnemonics.length)];
      loadMnemonic(random.name);
    }
  }, [mnemonics, selectedMnemonic, loadMnemonic]);

  // -----------------------------
  // Filtering
  // -----------------------------
  const filteredMnemonics = useMemo(() => {
    return mnemonics.filter(m =>
      m.label.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [mnemonics, searchTerm]);

  // -----------------------------
  // Save
  // -----------------------------
  const handleSave = async () => {
    if (!selectedMnemonic) return;

    try {
      await updateMnemonic(selectedMnemonic.name, selectedMnemonic);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 5000);
    } catch { }
  };

  // -----------------------------
  // Delete
  // -----------------------------
  const handleDelete = async () => {
    if (!selectedMnemonic) return;

    await deleteMnemonic(selectedMnemonic.name);
  };

  // -----------------------------
  // Loading & error
  // -----------------------------
  if (listLoading || detailsLoading) {
    return <div>Loading mnemonics...</div>;
  }

  if (listError) {
    return <div>Error loading mnemonics</div>;
  }

  if (detailsError) {
    return <div>Error loading mnemonic details</div>;
  }

  // -----------------------------
  // Render
  // -----------------------------
  return (
    <div className="signalTagContainer">
      <div style={{ marginBottom: '8px' }}>Mnemonics Configuration:</div>

      <div style={{ display: 'flex', gap: '10px' }}>
        {/* List */}
        <div className="signalTagList">
          <input
            type="text"
            placeholder="Search Mnemonics..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="signalSearchItem"
          />
          <ul>
            {filteredMnemonics.map(mnemonic => (
              <li
                key={mnemonic.id}
                className={`signalTagItem ${selectedMnemonic?.name === mnemonic.name ? 'selected' : ''
                  }`}
                onClick={() => loadMnemonic(mnemonic.name)}
              >
                {mnemonic.label}
              </li>
            ))}
          </ul>
        </div>

        {/* Details */}
        {selectedMnemonic && (
          <div className="signalTagDetails">
            <div>
              <span>Name:</span>
              <input
                value={selectedMnemonic.name}
                readOnly
                className="inputText"
              />
            </div>

            <div>
              <span>Alerting:</span>
              <input
                type="checkbox"
                checked={!!selectedMnemonic.alert}
                onChange={(e) =>
                  selectedMnemonic &&
                  (selectedMnemonic.alert = e.target.checked)
                }
              />
            </div>

            <div>
              <span>Severity:</span>
              <input value={selectedMnemonic.severity} readOnly />
            </div>

            <div>
              <span>Regexes:</span>
              <Select
                isMulti
                options={regExRules.map(o => ({
                  value: o.name,
                  label: o.name
                }))}
                value={regExRules
                  .filter(o => selectedMnemonic.regexes?.includes(o.name))
                  .map(o => ({ value: o.name, label: o.name }))}
                onChange={(opts) =>
                (selectedMnemonic.regexes =
                  opts?.map(o => o.value) || [])
                }
                styles={customStyles('380px')}
              />
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      {selectedMnemonic && (
        <div style={{ marginTop: '10px', textAlign: 'right' }}>
          {success && <div>Mnemonic updated successfully</div>}
          <button onClick={handleSave} className="button save-button">
            Save
          </button>
          <button onClick={handleDelete} className="button delete-button">
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

export default Mnemonics;
