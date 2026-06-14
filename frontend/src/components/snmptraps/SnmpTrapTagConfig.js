import React, { useState, useEffect } from "react";
import CreatableSelect from "react-select/creatable";
import "../../css/SyslogTagsList.css";
import customStyles from "../misc/SelectStyles";
import { TailSpin } from "react-loader-spinner";

import { useSnmpTrapTags } from "../../hooks/useSnmpTrapTags";

const SnmpTrapTagConfig = ({ keycloak, showNotification }) => {
  /* ---------------- hooks ---------------- */
  const { list: snmpTrapTags, details, get, create, update, remove, loading: snmpTrapTagsLoading, loadList: reloadSnmpTrapTags } = useSnmpTrapTags(keycloak, false);

  /* ---------------- UI state ---------------- */
  const [selectedTag, setSelectedTag] = useState(null);
  const [isAddNew, setIsAddNew] = useState(true);
  const [action, setAction] = useState(null);
  const [formError, setFormError] = useState("");
  const [loadingState, setLoadingState] = useState(null);
  const emptyForm = {
    name: '',
    oids: [],
  };

  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    if (details) {
      setForm({
        name: details.name,
        oids: details.oids.map(o => ({ value: o, label: o })) 
      });
    }
  }, [details]);

  // SELECT RULE
  const handleSelect = (tag) => {
    setSelectedTag(tag);
    setIsAddNew(false);
    get(tag.name);
    console.log("Selected tag:", tag);
  }; 
  
  // ADD
  const handleAdd = async () => {
    setLoadingState('adding');

    try {
      const payload = {
        ...form,
        oids: form.oids.map(o => o.value)
      };

      await create(payload);
      await reloadSnmpTrapTags();
      showNotification("Tag created successfully", "success");
      setForm(emptyForm);
      setIsAddNew(true);
    } catch (err) {
      showNotification(err.message || "Failed to create tag", "error");
    } finally {
      setLoadingState(null);
    }
  };

  // SAVE
  const handleSave = async () => {
    setLoadingState('saving');

    try {
      const payload = {
        ...form,
        oids: form.oids.map(o => o.value)
      };

      await update(form.name, payload);
      await reloadSnmpTrapTags();
      showNotification("Tag updated successfully", "success");
      setSelectedTag(null);
      setForm(emptyForm);
      setIsAddNew(true);
    } catch (err) {
      showNotification(err.message || "Failed to update tag", "error");
    } finally {
      setLoadingState(null);
    }
  };

  // DELETE
  const handleDelete = async () => {
    setLoadingState('deleting');
    try {
      await remove(selectedTag.name);
      await reloadSnmpTrapTags();
      //await loadList() 
      setSelectedTag(null);
      showNotification("Tag deleted successfully", "success");
      setForm(emptyForm);
      setIsAddNew(true);
    } catch (err) {
      showNotification(err.message || "Failed to delete tag", "error");
    } finally {
      setLoadingState(null);
    }
  }; 

  return (
    <div className="signalTagContainer">
      <div style={{ marginBottom: "8px" }}>
        SNMP Trap Tag Configuration:
      </div>

      <div style={{ display: "flex", gap: "10px" }}>
        {/* -------- tag list -------- */}
        <div
          style={{
            width: "240px",
            background: "var(--backgroundColor3)",
            borderRadius: "8px",
            padding: "8px",
            height: "250px",
            overflowY: "auto"
          }}
        >
          <ul style={{ padding: 0, listStyle: "none", margin: 0 }}>
            <li
              className={`signalTagItem ${isAddNew ? "selected" : ""}`}
              onClick={() => {
                setIsAddNew(true);
                setSelectedTag(null);
                setForm(emptyForm);
              }}
              style={{ marginBottom: "5px" }}
            >
              Add New Tag
            </li>

            {snmpTrapTags.map(tag => (
              <li
                key={tag.name}
                className={`signalTagItem ${selectedTag?.name === tag.name ? "selected" : ""
                  }`}
                onClick={() => handleSelect(tag)}
                style={{ marginBottom: "5px" }}
              >
                {tag.name}
              </li>
            ))}
          </ul>
        </div>

        {/* -------- editor -------- */}
        <div
          style={{
            padding: "8px",
            background: "var(--backgroundColor3)",
            borderRadius: "8px",
            width: "400px",
            height: "250px"
          }}
        >
          <div style={{ marginBottom: "10px" }}>
            <span>Name:</span>
            <input
              type="text"
              value={form.name}
              disabled={!isAddNew}
              className="inputText"
              style={{ width: "375px" }}
              onChange={e =>
                setForm({ ...form, name: e.target.value })
              }
            />
          </div>

          <div style={{ marginBottom: "15px" }}>
            <span>OIDs:</span>
            <CreatableSelect
              isMulti
              value={form.oids}
              onChange={oids => setForm({ ...form, oids })}
              onCreateOption={value =>
                setForm({
                  ...form,
                  oids: [...form.oids, { value, label: value }]
                })
              }
              styles={customStyles("380px")}
              placeholder="Type OIDs and press Enter"
            />
          </div>
        </div>
      </div>

      {/* -------- actions -------- */}
      <div style={{ marginTop: "10px", display: "flex", justifyContent: "flex-end" }}>
        {formError && <div style={{ color: "red" }}>{formError}</div>}

        {isAddNew ? (
          <button
            onClick={handleAdd}
            disabled={action === "adding"}
            className="button add-button"
          >
            {action === "adding" ? <TailSpin height={16} width={16} color="#fff" /> : "Add"}
          </button>
        ) : (
          <>
            <button
              onClick={handleDelete}
              disabled={action === "deleting"}
              className="button delete-button"
            >
              {action === "deleting" ? <TailSpin height={16} width={16} color="#fff" /> : "Delete"}
            </button>

            <button
              onClick={handleSave}
              disabled={action === "saving"}
              className="button save-button"
            >
              {action === "saving" ? <TailSpin height={16} width={16} color="#fff" /> : "Save"}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default SnmpTrapTagConfig;