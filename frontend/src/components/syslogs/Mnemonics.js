import React, { useState, useEffect } from 'react';
import Select from 'react-select';
import customStyles from '../misc/SelectStyles';
import '../../css/SyslogTagsList.css';
import apiClient from '../misc/AxiosConfig';

function Mnemonics({ currentUser, mnemonics, entityOptions }) {
    const [selectedMnemonic, setSelectedMnemonic] = useState(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [alert, setAlert] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [filteredMnemonics, setFilteredMnemonics] = useState(mnemonics || []);

    const handleMnemonicSelection = (mnemonic) => {
        setLoading(true);
        setError('');
        setAlert('');
        apiClient.get(`/syslogs/mnemonics/${mnemonic.name}/`)
            .then((response) => {
                setSelectedMnemonic({
                    ...response.data,
                    regexes: response.data.regexes || [],
                });
                console.log('Fetched Mnemonic Tag Details:', response.data);
            })
            .catch((error) => {
                console.error('Error fetching syslog tag details:', error);
            })
            .finally(() => setLoading(false));
    };

    const handleSave = async () => {
        try {
            const { name } = selectedMnemonic;
            const response = await apiClient.put(`/syslogs/update/mnemonics/${name}/`, selectedMnemonic);
            setSelectedMnemonic(response.data);
            setAlert("Tag updated successfully!");
        } catch (error) {
            console.error('Error updating mnemonic:', error);
            setAlert("Failed to update mnemonic. Please try again.");
        }
    };

    const handleSyncToRedis = async () => {
        try {
            await apiClient.post(`/syslogs/mnemonics/handleSyncToRedis/`);
            setAlert("Mnemonic rules synchronized successfully!");
        } catch (error) {
            console.error('Error syncing mnemonics rules:', error);
            setAlert("Failed to sync mnemonics rules. Please try again.");
        }
    };

    useEffect(() => {
        setFilteredMnemonics(
            mnemonics?.filter(mnemonic =>
                mnemonic?.label?.toLowerCase().includes(searchTerm.toLowerCase())
            ) || []
        );
    }, [searchTerm, mnemonics]);

    return (
        <div className="signalTagContainer">
            <div style={{ marginTop: '2px', marginBottom: '8px' }}>Mnemonics Configuration:</div>
            {isLoading ? (
                <div className="signalConfigRuleMessage">Loading stateful syslog rules. Please wait...</div>
            ) : error ? (
                <div className="signalConfigRuleMessage">{error}</div>
            ) : alert ? (
                <div className="signalConfigRuleMessage">{alert}</div>
            ) : (
                <>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <div className="signalTagList" style={{ flex: 1, maxHeight: '300px', overflowY: 'auto', paddingBottom: '10px' }}>
                            <input
                                type="text"
                                placeholder="Search Mnemonics..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="searchTagListElement"
                            />
                            <ul style={{ padding: 0, listStyle: 'none', margin: 0, marginBottom: '10px' }}>
                                {filteredMnemonics.map((mnemonic) => (
                                    <li
                                        key={mnemonic.id}
                                        className={`signalTagItem ${selectedMnemonic && selectedMnemonic.id === mnemonic.id ? 'selected' : ''}`}
                                        onClick={() => handleMnemonicSelection(mnemonic)}
                                        style={{
                                            width: '220px',
                                            whiteSpace: 'nowrap',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                        }}
                                    >
                                        {mnemonic.label}
                                    </li>
                                ))}
                            </ul>
                        </div>
                        {selectedMnemonic && (
                            <div style={{ padding: '8px', background: 'var(--backgroundColor3)', borderRadius: '8px', padding: '10px' }}>
                                <div style={{ marginBottom: '5px' }}>
                                    <span>Name:</span>
                                    <input
                                        type="text"
                                        name="name"
                                        value={selectedMnemonic.name}
                                        className="inputText"
                                        style={{ width: '375px' }}
                                        onChange={(e) => setSelectedMnemonic({ ...selectedMnemonic, name: e.target.value })}
                                    />
                                </div>

                                <div style={{ marginBottom: '5px' }}>
                                    <span>Severity:</span>
                                    <input
                                        type="text"
                                        name="severity"
                                        value={selectedMnemonic.severity}
                                        className="inputText"
                                        style={{ width: '375px' }}
                                        readOnly
                                    />
                                </div>

                                <div style={{ marginBottom: '5px' }}>
                                    <span>Regexes:</span>
                                    <Select
                                        isMulti
                                        name="regexes"
                                        options={entityOptions.map(option => ({
                                            value: option.name,
                                            label: option.name,
                                        }))}
                                        value={entityOptions
                                            .filter(opt => selectedMnemonic.regexes?.includes(opt.name))
                                            .map(opt => ({
                                                value: opt.name,
                                                label: opt.name,
                                            }))
                                        }
                                        onChange={(selectedOptions) => {
                                            const selectedNames = selectedOptions ? selectedOptions.map(opt => opt.value) : [];
                                            setSelectedMnemonic({
                                                ...selectedMnemonic,
                                                regexes: selectedNames,
                                            });
                                        }}
                                        styles={customStyles('380px')}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </>
            )}
            {!isLoading && !error && selectedMnemonic && (
                <div className="signalConfigButtonContainer">
                    <button onClick={handleSave} style={{ marginRight: '10px' }} className="buttonStyles saveRuleButton">
                        Save
                    </button>
                    <button onClick={handleSyncToRedis} className="addRuleButton">
                        Sync to Redis
                    </button>
                </div>
            )}
        </div>
    );
}

export default Mnemonics;
