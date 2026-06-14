import React, { useState, useEffect } from "react";
import Select from "react-select";
import "../../css/SyslogTagsList.css";
import customStyles from "../misc/SelectStyles";
import { TailSpin } from "react-loader-spinner";

import { useSnmpTrapOids } from "../../hooks/useSnmpTrapOids";
import { useSnmpTrapTags } from "../../hooks/useSnmpTrapTags"; 
import { useStatefulSyslogRules } from "../../hooks/useStatefulSyslogRules"; 

const SnmpTrapOid = ({ keycloak, showNotification }) => {
  /* ---------------- hooks ---------------- */
  const { details, loading, error, get, update, remove } = useSnmpTrapOids(keycloak);
  const { list: snmpTrapTags, loading: snmpTrapTagsLoading, loadList: reloadSnmpTrapTags } = useSnmpTrapTags(keycloak, false);
  const { list: snmpTrapOids, loading: oidsLoading, loadList: reloadSnmpTrapOids } = useSnmpTrapOids(keycloak);

  /* ---------------- UI state ---------------- */
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTrapOid, setSelectedTrapOid] = useState(null);
  const [selectedTagsForOid, setSelectedTagsForOid] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [updateError, setUpdateError] = useState("");

  /* ---------------- default selection ---------------- */
  useEffect(() => {
    if (snmpTrapOids.length && !selectedTrapOid) {
      setSelectedTrapOid(snmpTrapOids[0]);
      get(snmpTrapOids[0].name);
    }
  }, [snmpTrapOids, selectedTrapOid, get]);

  useEffect(() => {
    if (details) {
      setSelectedTrapOid(details);
    }
  }, [details]);

  const handleSelectTrapOid = (snmpTrapOid) => {
    get(snmpTrapOid.name);
  };

  /* ---------------- sync tags when selection changes ---------------- */
  useEffect(() => {
    if (selectedTrapOid?.tags) {
      setSelectedTagsForOid(
        selectedTrapOid.tags.map(t => ({ value: t, label: t }))
      );
    } else {
      setSelectedTagsForOid([]);
    }
  }, [selectedTrapOid]);

  /* ---------------- handlers ---------------- */
  const handleSave = async () => {
    if (!selectedTrapOid) return;

    setIsSaving(true);
    setUpdateError("");

    try {
      const tagNames = selectedTagsForOid.map(t => t.value);

      const updated = await update(
        selectedTrapOid.name,
        {
          ...selectedTrapOid,
          tags: tagNames
        }
      );

      setSelectedTrapOid(updated);
    } catch (err) {
      console.error(err);
      setUpdateError("Failed to update SNMP Trap OID tags.");
    } finally {
      setIsSaving(false);
    }
  };

  /* ---------------- derived data ---------------- */
  const filteredSnmpTrapOids = snmpTrapOids.filter(oid =>
    oid.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    oid.oid.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const tagOptions = snmpTrapTags.map(tag => ({
    value: tag.name,
    label: tag.name
  }));
 

  return (
    <div className="signalTagContainer">
      <div style={{ marginBottom: "8px" }}>
        SNMP Trap OIDs Configuration:
      </div>

      <div style={{ display: "flex", gap: "10px" }}>
        {/* -------- list -------- */}
        <div
          className="signalTagList"
          style={{ flex: 1, maxHeight: "300px", overflowY: "auto" }}
        >
          <input
            type="text"
            placeholder="Search SNMP Trap OIDs..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="signalSearchItem"
            style={{ width: "220px" }}
          />

          <ul style={{ padding: 0, listStyle: "none", margin: 0 }}>
            {filteredSnmpTrapOids.map(oid => (
              <li
                key={oid.id}
                className={`signalTagItem ${selectedTrapOid?.id === oid.id ? "selected" : ""
                  }`}
                onClick={() => handleSelectTrapOid(oid)}
              >
                {oid.name} ({oid.oid})
              </li>
            ))}
          </ul>
        </div>

        {/* -------- editor -------- */}
        {selectedTrapOid && (
          <div
            style={{
              padding: "18px",
              background: "var(--backgroundColor3)",
              borderRadius: "8px"
            }}
          >
            <div>
              <span>Name:</span>
              <input
                value={selectedTrapOid.name}
                className="inputText"
                readOnly
              />
            </div>

            <div style={{ margin: "10px 0" }}>
              <span>Alerting:</span>
              <input
                type="checkbox"
                checked={!!selectedTrapOid.alert}
                onChange={e =>
                  setSelectedTrapOid({
                    ...selectedTrapOid,
                    alert: e.target.checked
                  })
                }
              />
            </div>

            <div>
              <span>Label:</span>
              <input
                value={selectedTrapOid.label || ""}
                className="inputText"
                readOnly
              />
            </div>

            <div style={{ marginTop: "15px" }}>
              <span>Tags:</span>
              <Select
                isMulti
                value={selectedTagsForOid}
                options={tagOptions}
                //isLoading={tagsLoading}
                onChange={setSelectedTagsForOid}
                styles={customStyles("330px")}
              />
            </div>
          </div>
        )}
      </div>

      {/* -------- save -------- */}
      {selectedTrapOid && (
        <div style={{ marginTop: "10px", textAlign: "right" }}>
          {updateError && <div>{updateError}</div>}
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="button save-button"
          >
            {isSaving ? <TailSpin height={16} width={16} color="#fff" /> : "Save"}
          </button>
        </div>
      )}
    </div>
  );
};

export default SnmpTrapOid;