import React, { useState, useEffect } from 'react';
import Select from 'react-select';
import customStyles from '../misc/SelectStyles';
import '../../css/SyslogTagsList.css';
import apiClient from '../misc/AxiosConfig';
import { TailSpin } from 'react-loader-spinner';

function RegExConfig({ currentUser, regExpressions, onAdd, onDelete, onEdit, onSave }) {
  const [selectedRegEx, setSelectedRegEx] = useState(null);
  const [editedData, setEditedData] = useState({});
  const [isAddNewRegEx, setIsAddNewRegEx] = useState(true);
  const [syslogTags, setSyslogTags] = useState([]);
  const [regExData, setRegExData] = useState([]);
  const [newRegEx, setNewRegEx] = useState({
    name: '',
    tag: '',
    pattern: '',
    matchfunction: '',
    matchnumber: '',
    groupnumber: '',
    nomatch: null,
  })
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [alert, setAlert] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingState, setLoadingState] = useState(null);

  const handleOptionChange = (regEx) => {
    setSelectedRegEx(regEx);
    setIsAddNewRegEx(false);
    setEditedData(regEx);
    apiClient.get(`/syslogs/regex/${regEx.name}/`)
      .then((response) => {
        setNewRegEx(response.data);
        console.log('Fetched Syslog Reg Ex Details:', response.data);
      })
      .catch((error) => {
        console.error('Error fetching Reg Ex details:', error);
      });
  };

  const functionOptions = [
    { value: 'search', label: 'Search' },
    { value: 'findall', label: 'Findall' },
    { value: 'finditer', label: 'Finditer' },
  ];

  const handleAddRule = async () => {
    setLoadingState('adding');
    setAlert('');
    setError('');

    try {
      const payload = {
        name: newRegEx.name,
        pattern: newRegEx.pattern,
        matchfunction: newRegEx.matchfunction,
        matchnumber: newRegEx.matchnumber,
        groupnumber: newRegEx.groupnumber,
        nomatch: newRegEx.nomatch,
        tag: newRegEx.tag,
      };

      const response = await apiClient.post('/syslogs/regex/', payload);
      const addedRegEx = response.data;

      setAlert('Tag added successfully');
      setRegExData((prev) => [...prev, addedRegEx]);
      setNewRegEx({
        name: '',
        pattern: '',
        matchfunction: '',
        matchnumber: '',
        groupnumber: '',
        nomatch: null,
        tag: '',
      });
      setIsAddNewRegEx(true);

      if (onAdd) onAdd(addedRegEx); // ✅ call parent callback

      setTimeout(() => setAlert(''), 3000);
    } catch (error) {
      setError('Error adding tag. Please try again.');
      console.error('Error adding tag:', error);
      setNewRegEx({
        name: '',
        pattern: '',
        matchfunction: '',
        matchnumber: '',
        groupnumber: '',
        nomatch: null,
        tag: '',
      });
      setTimeout(() => setError(''), 3000);
    } finally {
      setLoadingState(null);
    }
  };


  const handleSave = async () => {
    setLoadingState('saving');
    setAlert('');
    setError('');

    try {
      const { name } = newRegEx;
      const response = await apiClient.put(`/syslogs/regex/${name}/`, newRegEx);
      const updatedRegEx = response.data;

      setSelectedRegEx(updatedRegEx);
      setAlert("Tag updated successfully!");
      setNewRegEx({
        name: '',
        pattern: '',
        matchfunction: '',
        matchnumber: '',
        groupnumber: '',
        nomatch: null,
        tag: '',
      });
      setIsAddNewRegEx(true);

      if (onEdit) onEdit(updatedRegEx); // ✅ call parent callback
    } catch (error) {
      console.error('Error updating tag:', error);
      setAlert("Failed to update tag. Please try again.");
    } finally {
      setLoadingState(null);
    }
  };

  const handleDelete = async () => {
    setLoadingState('deleting');
    try {
      await apiClient.delete(`/syslogs/regex/${editedData.name}/`);

      const updatedList = syslogTags.filter(tag => tag.id !== editedData.id);
      setRegExData(updatedList);
      setSelectedRegEx(null);
      setIsAddNewRegEx(true);
      setNewRegEx({
        name: '',
        pattern: '',
        matchfunction: '',
        matchnumber: '',
        groupnumber: '',
        nomatch: null,
        tag: '',
      });
      setAlert("Tag deleted successfully!");

      if (onDelete) onDelete(editedData); // ✅ call parent callback
    } catch (error) {
      console.error('Error deleting tag:', error);
      setAlert("Failed to delete tag. Please try again.");
    } finally {
      setLoadingState(null);
    }
  };

  const handleSyncToRedis = async () => {
    try {
      await apiClient.post(`/syslogs/regex/handleSyncToRedis/`);
      setAlert("Regex rules synchronized successfully!");
    } catch (error) {
      console.error('Error syncing regex rules:', error);
      setAlert("Failed to sync regex rules. Please try again.");
    }
  };

  return (
    <div className="signalTagContainer" >
      <div style={{ marginTop: '2px' }}>Regular Expressions Configuration:</div>
      {isLoading ? (
        <div className="signalConfigRuleMessage" style={{background: 'var(--backgroundColor3)', padding: '10px', marginTop: '10px', borderRadius: '8px'}}>Loading Regular Expressions. Please wait...</div>
      ) : error ? (
        <div className="signalConfigRuleMessage" style={{background: 'var(--backgroundColor3)', padding: '10px', marginTop: '10px', borderRadius: '8px'}}>{error}</div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: '10px' }}>
            <div style={{ width: '240px', padding: '8px', background: 'var(--backgroundColor3)', height: '280px', borderRadius: '8px', overflowY: 'auto' }}>
              <ul style={{ padding: 0, listStyle: 'none', margin: 0, marginBottom: '10px' }}>
                <li
                  className={`signalTagItem ${isAddNewRegEx ? 'selected' : ''}`}
                  onClick={() => {
                    setIsAddNewRegEx(true);
                    setSelectedRegEx(null);
                    setNewRegEx({
                      name: '',
                      pattern: '',
                      matchfunction: '',
                      matchnumber: '',
                      groupnumber: '',
                      nomatch: null,
                      tag: '',
                    });
                  }}
                >
                  Add New Rule
                </li>
                {regExpressions.map((regex) => (
                  <li
                    key={regex.id}
                    className={`signalTagItem ${selectedRegEx && selectedRegEx.id === regex.id ? 'selected' : ''}`}
                    onClick={() => handleOptionChange(regex)}
                  >
                    {regex.name}
                  </li>
                ))}
              </ul>
            </div>
            <div style={{ padding: '8px', background: 'var(--backgroundColor3)', color: 'var(--textColor)', borderRadius: '8px', height: '280px', overflowY: 'auto', width: '400px' }}>
              <div style={{ marginBottom: '5px' }}>
                <span>Name:</span>
                <input
                  type="text"
                  name="name"
                  value={newRegEx.name}
                  className="inputText"
                  style={{ width: '375px' }}
                  onChange={(e) => setNewRegEx({ ...newRegEx, name: e.target.value })}
                />
              </div>
              <div style={{ marginBottom: '5px' }}>
                <span>Tag:</span>
                <input
                  type="text"
                  name="tag"
                  value={newRegEx.tag}
                  className="inputText"
                  style={{ width: '375px' }}
                  onChange={(e) => setNewRegEx({ ...newRegEx, tag: e.target.value })}
                />
              </div>
              <div style={{ marginBottom: '5px' }}>
                <span>Pattern:</span>
                <input
                  type="text"
                  name="name"
                  value={newRegEx.pattern}
                  className="inputText"
                  style={{ width: '375px' }}
                  onChange={(e) =>
                    setNewRegEx({ ...newRegEx, pattern: e.target.value })
                  }
                />
              </div>
              <div style={{ marginBottom: '5px' }}>
                <span>Match function:</span>
                <Select
                  name="matchfunction"
                  value={functionOptions.find(option => option.value === newRegEx.matchfunction)}
                  options={functionOptions}
                  onChange={(selectedOption) =>
                    setNewRegEx({ ...newRegEx, matchfunction: selectedOption.value })}
                  styles={{
                    ...customStyles('375px'),
                    menuPortal: base => ({ ...base, zIndex: 9999 })
                  }}
                  menuPortalTarget={document.body}
                  isMulti={false}
                />
              </div>
              <div style={{ display: "flex", marginBottom: '5px' }}>
                <div style={{ width: '50%' }}>
                  <span>Match Number:</span>
                  <input
                    type="number"
                    name="matchnumber"
                    value={newRegEx.matchnumber}
                    className="inputText"
                    style={{ width: '170px' }}
                    onChange={(e) =>
                      setNewRegEx({ ...newRegEx, matchnumber: e.target.value })
                    }
                  />
                </div>
                <div style={{ width: '50%', marginLeft: '15px' }}>
                  <span>Group Number:</span>
                  <input
                    type="number"
                    name="groupnumber"
                    value={newRegEx.groupnumber}
                    className="inputText"
                    style={{ width: '170px' }}
                    onChange={(e) =>
                      setNewRegEx({ ...newRegEx, groupnumber: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="tag-detail-row" style={{ marginTop: '6px' }}>
                <span>No match:</span>
                <input
                  type="text"
                  name="nomatch"
                  value={newRegEx.nomatch}
                  className="inputText"
                  style={{ width: '375px' }}
                  onChange={(e) =>
                    setNewRegEx({ ...newRegEx, nomatch: e.target.value })
                  }
                />
              </div>
            </div>
          </div>
        </>
      )
      }
      {
        !isLoading && !error && (
          <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'flex-end' }}>
            {isAddNewRegEx ? (
              <>

                <button onClick={() => setIsAddNewRegEx(false)} className="button cancel-button">Cancel</button>

                <button onClick={handleAddRule} disabled={loadingState === 'adding'} className="button add-button">
                  {loadingState === 'adding' ? <TailSpin height={16} width={16} color="#fff" /> : 'Add Rule'}
                </button>
              </>
            ) : (
              selectedRegEx && (
                <>

                  <button onClick={handleDelete} disabled={loadingState === 'removing'} className="button delete-button">
                    {loadingState === 'removing' ? <TailSpin height={16} width={16} color="#fff" /> : 'Delete'}
                  </button>
                  <button onClick={handleSave} disabled={loadingState === 'editing'} className="button save-button">
                    {loadingState === 'editing' ? <TailSpin height={16} width={16} color="#fff" /> : 'Save'}
                  </button>
                </>
              )
            )}
          </div>
        )
      }
    </div >
  );

}

export default RegExConfig;
