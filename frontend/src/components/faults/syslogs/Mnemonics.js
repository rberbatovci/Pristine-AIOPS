import { useState, useEffect, useMemo } from 'react';
import Select from 'react-select';
import customStyles from '../../misc/SelectStyles';
import { useMnemonics } from '../../../hooks/useMnemonics';
import { useMnemonicDetails } from '../../../hooks/useMnemonicDetails';
import { useSyslogRegEx } from '../../../hooks/useSyslogRegEx';
import '../../../css/SyslogTagsList.css';

function Mnemonics({ showNotification, keycloak }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMnemonic, setSelectedMnemonic] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');

  const { mnemonics, reload: reloadMnemonics } = useMnemonics(keycloak);
  const { list: regularExpressions } = useSyslogRegEx(keycloak);

  const {
    details,
    loading,
    error,
    loadMnemonic,
    updateMnemonic,
    deleteMnemonic
  } = useMnemonicDetails(keycloak);

  useEffect(() => {
    if (!selectedMnemonic && mnemonics && mnemonics.length > 0) {
      const first = mnemonics[0];
      loadMnemonic(first.name);
    }
  }, [mnemonics, selectedMnemonic, loadMnemonic]);

  useEffect(() => {
    if (details) {
      setSelectedMnemonic(details);
    }
  }, [details]);

  const filteredMnemonics = useMemo(() => {
    return (mnemonics || []).filter(m =>
      (m.label || m.name || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [mnemonics, searchTerm]);

  const regexOptions = useMemo(() => {
    if (!regularExpressions?.length) return [];
    return regularExpressions.map(r => ({
      value: r.id,
      label: r.name
    }));
  }, [regularExpressions]);

  const currentSelectedRegexOptions = useMemo(() => {
    if (!selectedMnemonic?.regexes?.length) return [];

    return selectedMnemonic.regexes
      .map(name => regexOptions.find(opt => opt.label === name))
      .filter(Boolean);
  }, [selectedMnemonic, regexOptions]);

  useEffect(() => {
    console.log("regularExpressions:", regularExpressions);
    console.log("regexOptions:", regexOptions);
    console.log("selectedMnemonic:", selectedMnemonic);
  }, [regularExpressions, regexOptions, selectedMnemonic]);

  const handleSelectMnemonic = (mnemonic) => {
    loadMnemonic(mnemonic.name);
  };

  const handleRegexChange = (selectedOptions) => {
    const updatedRegexNames = selectedOptions
      ? selectedOptions.map(o => o.label)
      : [];

    setSelectedMnemonic(prev => ({
      ...prev,
      regexes: updatedRegexNames
    }));
  };

  const handleSave = async () => {
    if (!selectedMnemonic) return;
    try {
      await updateMnemonic(selectedMnemonic.name, selectedMnemonic);
      setSuccessMessage('Mnemonic updated successfully');
      showNotification?.('Mnemonic updated successfully', 'success');
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (err) {
      showNotification?.('Failed to update mnemonic', 'error');
    }
  };

  const handleDelete = async () => {
    if (!selectedMnemonic) return;
    if (!window.confirm(`Are you sure you want to delete ${selectedMnemonic.name}?`)) return;

    try {
      await deleteMnemonic(selectedMnemonic.name);
      showNotification?.(`Deleted mnemonic: ${selectedMnemonic.name}`, 'success');
      setSelectedMnemonic(null);
    } catch (err) {
      showNotification?.('Failed to delete mnemonic', 'error');
    }
  };

  if (!mnemonics || mnemonics.length === 0) {
    return <div className="loading-state">Loading mnemonics list...</div>;
  }

  return (
    <div className="signalTagContainer">
      <div style={{ marginBottom: '8px', fontWeight: 'bold' }}>Mnemonics Configuration:</div>

      {error && <div style={{ color: 'red', marginBottom: '10px' }}>Error: {error.message}</div>}

      <div style={{ display: 'flex', gap: '10px', opacity: loading ? 0.7 : 1 }}>
        {/* Mnemonics List */}
        <div className="signalTagList">
          <input
            type="text"
            placeholder="Search Mnemonics..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="signalSearchItem"
          />
          <ul>
            {filteredMnemonics.map(m => (
              <li
                key={m.id || m.name}
                className={`signalTagItem ${selectedMnemonic?.name === m.name ? 'selected' : ''}`}
                onClick={() => handleSelectMnemonic(m)}
              >
                {m.label || m.name}
              </li>
            ))}
          </ul>
        </div>

        {/* Mnemonic Details Form */}
        <div className="signalTagDetails">
          {loading && !selectedMnemonic ? (
            <div>Loading details...</div>
          ) : selectedMnemonic ? (
            <>
              <div>
                <span>Name:</span>
                <input value={selectedMnemonic.name || ''} readOnly className="inputText" />
              </div>

              <div>
                <span>Alerting:</span>
                <input
                  type="checkbox"
                  checked={!!selectedMnemonic.alert}
                  onChange={(e) =>
                    setSelectedMnemonic(prev => ({ ...prev, alert: e.target.checked }))
                  }
                />
              </div>

              <div>
                <span>Severity:</span>
                <input value={selectedMnemonic.severity || ''} readOnly />
              </div>
              <div>
                <span>Regexes:</span>
                <Select
                  isMulti
                  options={regexOptions}
                  value={currentSelectedRegexOptions}
                  onChange={handleRegexChange}
                  styles={customStyles('380px')}
                  placeholder={
                    regularExpressions?.length
                      ? "Select Regexes..."
                      : "Loading expressions..."
                  }
                  isLoading={!regularExpressions?.length}
                />
              </div>
            </>
          ) : (
            <div>Select a mnemonic to view details</div>
          )}
        </div>
      </div>

      {/* Actions */}
      {selectedMnemonic && (
        <div style={{ marginTop: '10px', textAlign: 'right' }}>
          {successMessage && <span style={{ color: 'green', marginRight: '10px' }}>{successMessage}</span>}
          <button
            onClick={handleSave}
            className="button save-button"
            disabled={loading}
          >
            {loading ? 'Saving...' : 'Save'}
          </button>
          <button
            onClick={handleDelete}
            className="button delete-button"
            disabled={loading}
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

export default Mnemonics;