import React, { useState, useEffect } from 'react';
import Select from 'react-select';
import customStyles from '../misc/SelectStyles';
import '../../css/SyslogTagsList.css';
import apiClient from '../misc/AxiosConfig';
import { TailSpin } from 'react-loader-spinner';

function Mnemonics({ currentUser, mnemonics, entityOptions }) {
    const [selectedMnemonic, setSelectedMnemonic] = useState(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');
    const [alert, setAlert] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [filteredMnemonics, setFilteredMnemonics] = useState(mnemonics || []);
    const [onSuccesss, setOnSuccesss] = useState(false);

    const handleMnemonicSelection = (mnemonic) => {
        setIsLoading(true);
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
            .finally(() => setIsLoading(false));
    };

    useEffect(() => {
        if (mnemonics && mnemonics.length > 0 && !selectedMnemonic) {
            const randomIndex = Math.floor(Math.random() * mnemonics.length);
            const randomMnemonic = mnemonics[randomIndex];
            handleMnemonicSelection(randomMnemonic);
        }
    }, [mnemonics]);

    const handleSave = async () => {
        setIsSaving(true);
        setError('');
        setAlert('');
        setOnSuccesss(false);

        // Auto-clear saving after 30s in case of a stuck state
        setTimeout(() => {
            setIsSaving(false);
            console.log("⏱️ isSaving turned off after 30s");
        }, 30000);

        try {
            const { name } = selectedMnemonic;
            const response = await apiClient.put(`/syslogs/update/mnemonics/${name}/`, selectedMnemonic);
            setSelectedMnemonic(response.data);

            // ✅ Show success and auto-hide after 5s
            setOnSuccesss(true);
            setTimeout(() => {
                setOnSuccesss(false);
            }, 5000);
        } catch (error) {
            console.error('Error updating mnemonic:', error);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        try {
            const { name } = selectedMnemonic;
            const response = await apiClient.delete(`/syslogs/mnemonics/${name}/`, selectedMnemonic);
            setSelectedMnemonic(null);
            setAlert("Tag deleted successfully!");
        } catch (error) {
            console.error('Error delete mnemonic:', error);
            setAlert("Failed to delete mnemonic. Please try again.");
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
            ) : (
                <>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <div className="signalTagList" style={{ flex: 1, maxHeight: '300px', overflowY: 'auto', paddingBottom: '10px' }}>
                            <input
                                type="text"
                                placeholder="Search Mnemonics..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="signalSearchItem"
                                style={{ width: '220px', outline: 'none' }}
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
                                <div style={{ marginTop: '10px', marginBottom: '10px' }}>
                                    <span style={{ marginRight: '10px' }}>Alerting:</span>
                                    <input
                                        type="checkbox"
                                        checked={!!selectedMnemonic.alert}
                                        onChange={(e) => setSelectedMnemonic({
                                            ...selectedMnemonic,
                                            alert: e.target.checked
                                        })}
                                    />
                                    <span style={{ marginLeft: '8px' }}>
                                        {selectedMnemonic.alert ? 'True' : 'False'}
                                    </span>
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
                <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'flex-end' }}>
                    {onSuccesss ? (<div style={{ padding: '12px', borderRadius: '6px', width: '100%', background: 'var(--backgroundColor3)'}}> Mnemnic has been updated successfully</div>) : (<div><button onClick={handleSave} disabled={isSaving} style={{ marginRight: '10px' }} className="button save-button">
                        {isSaving ? <TailSpin height={16} width={16} color="#fff" /> : 'Save'}
                    </button> </div>)}

                </div>
            )}
        </div>
    );
}

export default Mnemonics;
