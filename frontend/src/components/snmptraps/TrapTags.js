import React, { useState, useEffect } from "react";
import CreatableSelect from "react-select/creatable";
import "../../css/SyslogTagsList.css";
import customStyles from "../misc/SelectStyles";
import { TailSpin } from "react-loader-spinner";

import { useTrapTags2 } from "../../hooks/useTrapTags2";

const TrapTags = ({ keycloak }) => {
  /* ---------------- hooks ---------------- */
  const {
    items: trapTags,
    loading,
    error,
    create,
    update,
    remove
  } = useTrapTags2(keycloak);

  /* ---------------- UI state ---------------- */
  const [selectedTag, setSelectedTag] = useState(null);
  const [isAddMode, setIsAddMode] = useState(true);
  const [form, setForm] = useState({ name: "", oids: [] });
  const [action, setAction] = useState(null); // adding | saving | deleting 
  const [formError, setFormError] = useState("");

  /* ---------------- sync form on selection ---------------- */
  useEffect(() => {
    if (selectedTag) {
      setForm({
        name: selectedTag.name,
        oids: selectedTag.oids?.map(o => ({ value: o, label: o })) || []
      });
      setIsAddMode(false);
    } else {
      setForm({ name: "", oids: [] });
      setIsAddMode(true);
    }
  }, [selectedTag]);

  /* ---------------- handlers ---------------- */
  const handleAdd = async () => {
    setAction("adding");
    setFormError("");

    try {
      await create({
        name: form.name,
        oids: form.oids.map(o => o.value)
      });

      setSelectedTag(null);
    } catch (err) {
      console.error(err);
      setFormError("Failed to create trap tag.");
    } finally {
      setAction(null);
    }
  };

  const handleSave = async () => {
    if (!selectedTag) return;

    setAction("saving");
    setFormError("");

    try {
      await update(selectedTag.name, {
        oids: form.oids.map(o => o.value)
      });

      setSelectedTag(null);
    } catch (err) {
      console.error(err);
      setFormError("Failed to update trap tag.");
    } finally {
      setAction(null);
    }
  };

  const handleDelete = async () => {
    if (!selectedTag) return;

    setAction("deleting");

    try {
      await remove(selectedTag.name);
      setSelectedTag(null);
    } catch (err) {
      console.error(err);
      setFormError("Failed to delete trap tag.");
    } finally {
      setAction(null);
    }
  };

  /* ---------------- render ---------------- */
  if (loading) {
    return <div className="signalConfigRuleMessage">Loading trap tags…</div>;
  }

  if (error) {
    return <div className="signalConfigRuleMessage">Failed to load trap tags</div>;
  }

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
              className={`signalTagItem ${isAddMode ? "selected" : ""}`}
              onClick={() => setSelectedTag(null)}
              style={{ marginBottom: "5px" }}
            >
              Add New Tag
            </li>

            {trapTags.map(tag => (
              <li
                key={tag.name}
                className={`signalTagItem ${
                  selectedTag?.name === tag.name ? "selected" : ""
                }`}
                onClick={() => setSelectedTag(tag)}
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
              disabled={!isAddMode}
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

        {isAddMode ? (
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

export default TrapTags;