import React, { useState } from 'react';
import Select from 'react-select';
import customStyles from '../misc/SelectStyles';
import '../../css/SyslogTagsList.css';
import { TailSpin } from 'react-loader-spinner';

import { useSyslogRegEx } from '../../hooks/useSyslogRegEx';

function RegExConfig({ keycloak }) {
  const {
    regExRules,
    loading,
    error,
    get,
    create,
    update,
    remove,
  } = useSyslogRegEx({ keycloak });

  const [selectedRegex, setSelectedRegex] = useState(null);
  const [isAddNew, setIsAddNew] = useState(true);
  const [loadingState, setLoadingState] = useState(null);

  const emptyForm = {
    name: '',
    tag: '',
    pattern: '',
    matchfunction: '',
    matchnumber: '',
    groupnumber: '',
    nomatch: null,
  };

  const [form, setForm] = useState(emptyForm);

  const functionOptions = [
    { value: 'search', label: 'Search' },
    { value: 'findall', label: 'Findall' },
    { value: 'finditer', label: 'Finditer' },
  ];

  const handleSelect = async (regex) => {
    const full = await get(regex.name);
    setSelectedRegex(full);
    setForm(full);
    setIsAddNew(false);
  };

  const handleAdd = async () => {
    setLoadingState('adding');
    await create(form);
    setForm(emptyForm);
    setIsAddNew(true);
    setLoadingState(null);
  };

  const handleSave = async () => {
    setLoadingState('saving');
    await update(form.name, form);
    setSelectedRegex(null);
    setForm(emptyForm);
    setIsAddNew(true);
    setLoadingState(null);
  };

  const handleDelete = async () => {
    setLoadingState('deleting');
    await remove(selectedRegex.name);
    setSelectedRegex(null);
    setForm(emptyForm);
    setIsAddNew(true);
    setLoadingState(null);
  };

  return (
    <div className="signalTagContainer">
      <div style={{ marginTop: '2px' }}>
        Regular Expressions Configuration:
      </div>

      {loading ? (
        <div
          className="signalConfigRuleMessage"
          style={{
            background: 'var(--backgroundColor3)',
            padding: '10px',
            marginTop: '10px',
            borderRadius: '8px'
          }}
        >
          Loading Regular Expressions. Please wait...
        </div>
      ) : error ? (
        <div
          className="signalConfigRuleMessage"
          style={{
            background: 'var(--backgroundColor3)',
            padding: '10px',
            marginTop: '10px',
            borderRadius: '8px'
          }}
        >
          {error}
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: '10px' }}>

            {/* LEFT PANEL */}
            <div
              style={{
                width: '240px',
                padding: '8px',
                background: 'var(--backgroundColor3)',
                height: '280px',
                borderRadius: '8px',
                overflowY: 'auto'
              }}
            >
              <ul style={{ padding: 0, listStyle: 'none', margin: 0 }}>
                <li
                  className={`signalTagItem ${isAddNew ? 'selected' : ''}`}
                  onClick={() => {
                    setIsAddNew(true);
                    setSelectedRegex(null);
                    setForm(emptyForm);
                  }}
                >
                  Add New Rule
                </li>

                {regExRules.map((regex) => (
                  <li
                    key={regex.name}
                    className={`signalTagItem ${selectedRegex?.name === regex.name ? 'selected' : ''
                      }`}
                    onClick={async () => {
                      const full = await get(regex.name);
                      setSelectedRegex(full);
                      setForm(full);
                      setIsAddNew(false);
                    }}
                  >
                    {regex.name}
                  </li>
                ))}
              </ul>
            </div>

            {/* RIGHT PANEL */}
            <div
              style={{
                padding: '8px',
                background: 'var(--backgroundColor3)',
                color: 'var(--textColor)',
                borderRadius: '8px',
                height: '280px',
                overflowY: 'auto',
                width: '400px'
              }}
            >
              <div style={{ marginBottom: '5px' }}>
                <span>Name:</span>
                <input
                  type="text"
                  value={form.name}
                  disabled={!isAddNew}
                  className="inputText"
                  style={{ width: '375px' }}
                  onChange={(e) =>
                    setForm({ ...form, name: e.target.value })
                  }
                />
              </div>

              <div style={{ marginBottom: '5px' }}>
                <span>Tag:</span>
                <input
                  type="text"
                  value={form.tag}
                  className="inputText"
                  style={{ width: '375px' }}
                  onChange={(e) =>
                    setForm({ ...form, tag: e.target.value })
                  }
                />
              </div>

              <div style={{ marginBottom: '5px' }}>
                <span>Pattern:</span>
                <input
                  type="text"
                  value={form.pattern}
                  className="inputText"
                  style={{ width: '375px' }}
                  onChange={(e) =>
                    setForm({ ...form, pattern: e.target.value })
                  }
                />
              </div>

              <div style={{ marginBottom: '5px' }}>
                <span>Match Function:</span>
                <Select
                  value={functionOptions.find(
                    (option) => option.value === form.matchfunction
                  )}
                  options={functionOptions}
                  onChange={(selectedOption) =>
                    setForm({
                      ...form,
                      matchfunction: selectedOption.value
                    })
                  }
                  styles={customStyles('375px')}
                  menuPortalTarget={document.body}
                />
              </div>

              <div style={{ display: "flex", marginBottom: '5px' }}>
                <div style={{ width: '50%' }}>
                  <span>Match Number:</span>
                  <input
                    type="number"
                    value={form.matchnumber}
                    className="inputText"
                    style={{ width: '170px' }}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        matchnumber: e.target.value
                      })
                    }
                  />
                </div>

                <div style={{ width: '50%', marginLeft: '15px' }}>
                  <span>Group Number:</span>
                  <input
                    type="number"
                    value={form.groupnumber}
                    className="inputText"
                    style={{ width: '170px' }}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        groupnumber: e.target.value
                      })
                    }
                  />
                </div>
              </div>

              <div style={{ marginTop: '6px' }}>
                <span>No Match:</span>
                <input
                  type="checkbox"
                  checked={!!form.nomatch}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      nomatch: e.target.checked
                    })
                  }
                />
              </div>
            </div>
          </div>

          {/* ACTION BUTTONS */}
          <div
            style={{
              marginTop: '10px',
              display: 'flex',
              justifyContent: 'flex-end'
            }}
          >
            {isAddNew ? (
              <>
                <button
                  onClick={() => {
                    setForm(emptyForm);
                  }}
                  className="button cancel-button"
                >
                  Cancel
                </button>

                <button
                  onClick={handleAdd}
                  disabled={loadingState === 'adding'}
                  className="button add-button"
                >
                  {loadingState === 'adding' ? (
                    <TailSpin height={16} width={16} color="#fff" />
                  ) : (
                    'Add Rule'
                  )}
                </button>
              </>
            ) : (
              selectedRegex && (
                <>
                  <button
                    onClick={handleDelete}
                    disabled={loadingState === 'deleting'}
                    className="button delete-button"
                  >
                    {loadingState === 'deleting' ? (
                      <TailSpin height={16} width={16} color="#fff" />
                    ) : (
                      'Delete'
                    )}
                  </button>

                  <button
                    onClick={handleSave}
                    disabled={loadingState === 'saving'}
                    className="button save-button"
                  >
                    {loadingState === 'saving' ? (
                      <TailSpin height={16} width={16} color="#fff" />
                    ) : (
                      'Save'
                    )}
                  </button>
                </>
              )
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default RegExConfig;