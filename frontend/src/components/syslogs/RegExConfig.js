import React, { useState, useEffect } from 'react';
import Select from 'react-select';
import customStyles from '../misc/SelectStyles';
import '../../css/SyslogTagsList.css';
import apiClient from '../misc/AxiosConfig';

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
    setLoading(true);
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
      setAlert('Tag added successfully');
      console.log('Tag added successfully:', response.data);
      setRegExData((prevTags) => [...prevTags, response.data]);
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
      setTimeout(() => {
        setAlert('');
      }, 3000);
    } catch (error) {
      setError('Error adding tag. Please try again.');
      console.error('Error adding tag:', error);
      setTimeout(() => {
        setError('');
      }, 3000);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      const { name } = newRegEx;
      const response = await apiClient.put(`/syslogs/regex/${name}/`, newRegEx);
      setSelectedRegEx(response.data);
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
    } catch (error) {
      console.error('Error updating tag:', error);
      setAlert("Failed to update tag. Please try again.");
    }
  };

  const handleDelete = async () => {
    try {
      await apiClient.delete(`/syslogs/regex/${editedData.name}/`);
      setRegExData(syslogTags.filter(tag => tag.id !== editedData.id));
      setSelectedRegEx(null);
      setAlert("Tag deleted successfully!");
    } catch (error) {
      console.error('Error deleting tag:', error);
      setAlert("Failed to delete tag. Please try again.");
    }
  };

  return (
    <div className="signalTagContainer">
      <div style={{ marginTop: '2px' }}>Syslog Tag Configuration:</div>
      {isLoading ? (
        <div className="signalConfigRuleMessage">Loading stateful syslog rules. Please wait...</div>
      ) : error ? (
        <div className="signalConfigRuleMessage">{error}</div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: '10px' }}>
            <div style={{ width: '240px', padding: '8px', background: 'var(--backgroundColor3)', borderRadius: '8px' }}>
              <ul style={{
                padding: 0, listStyle: 'none', margin: 0, height: 'auto',
                maxHeight: '100%',
                marginBottom: '5px',
                overflowY: 'auto'
              }}>
                <li
                  className={`button ${isAddNewRegEx ? 'button-active' : ''}`}
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
                    className={`button ${selectedRegEx && selectedRegEx.id === regex.id ? 'button-active' : ''}`}
                    onClick={() => handleOptionChange(regex)}
                  >
                    {regex.name} 
                  </li>
                ))}
              </ul>
            </div>
            <div style={{ padding: '8px', background: 'var(--backgroundColor3)', borderRadius: '8px' }}>
              <div style={{ marginBottom: '5px'}}>
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
                  styles={customStyles}
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
                    style={{ width: '175px' }}
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
                    style={{ width: '175px' }}
                    onChange={(e) =>
                      setNewRegEx({ ...newRegEx, groupnumber: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="tag-detail-row" style={{ marginTop: '6px' }}>
                <div className="tagDetailRowText">No match:</div>
                <div style={{ width: '70%' }}>
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
          </div>
        </>
      )
      }
      {
        !isLoading && !error && (
          <div className="signalConfigButtonContainer">
            {isAddNewRegEx ? (
              <>
                <button onClick={handleAddRule} className="addRuleButton">
                  Add Rule
                </button>
                <button onClick={() => setIsAddNewRegEx(false)}>Cancel</button>
              </>
            ) : (
              selectedRegEx && (
                <>
                  <button onClick={handleSave} style={{ marginRight: '10px' }} className="saveRuleButton">
                    Save
                  </button>
                  <button
                    onClick={handleDelete}
                    style={{ backgroundColor: 'red', color: 'white' }}
                    className="deleteRuleButton"
                  >
                    Delete
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
