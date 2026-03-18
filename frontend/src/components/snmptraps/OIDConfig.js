import React, { useState } from "react";
import "../../css/SyslogTagsList.css";
import { useSnmpTrapOids } from "../../hooks/useSnmpTrapOids";

function OIDConfig({ keycloak, devices }) {
  const {
    snmpTrapOids,
    fetchTrapOidDetails,
    updateTrapOid,
    deleteTrapOid,
    deleteAllTrapOids,
    loading,
    error
  } = useSnmpTrapOids(keycloak);
  const [selectedOption, setSelectedOption] = useState(null);
  const [formData, setFormData] = useState({});
  const [alert, setAlert] = useState("");

  const handleOidSelection = async (oid) => {
    const data = await fetchTrapOidDetails(oid.id);
    setSelectedOption(oid);
    setFormData(data);
  };

  const handleSave = async () => {
    try {
      const updated = await updateTrapOid(formData.id, formData);
      setFormData(updated);
      setAlert("OID updated successfully");
    } catch {
      setAlert("Failed to update OID");
    }
  };

  const handleDelete = async () => {
    try {
      await deleteTrapOid(formData.id);
      setSelectedOption(null);
      setAlert("OID deleted");
    } catch {
      setAlert("Failed to delete");
    }
  };

  const handleDeleteAll = async () => {
    await deleteAllTrapOids();
    setSelectedOption(null);
    setAlert("All trap OIDs deleted");
  };

  if (loading) return <div>Loading SNMP Trap OIDs...</div>;
  if (error) return <div>Error loading data</div>;

  return (
    <div className="signalTagContainer">
      {alert && <div className="signalConfigRuleMessage">{alert}</div>}
      <div style={{ display: "flex", gap: "10px" }}>
        <div
          style={{
            width: "240px",
            padding: "8px",
            background: "var(--backgroundColor3)",
            borderRadius: "8px"
          }}
        >
          <ul style={{ padding: 0, listStyle: "none" }}>
            {snmpTrapOids.map((oid) => (
              <li
                key={oid.id}
                className={`button ${
                  selectedOption?.id === oid.id ? "button-active" : ""
                }`}
                onClick={() => handleOidSelection(oid)}
              >
                {oid.label}
              </li>
            ))}
          </ul>
        </div>
        {selectedOption && (
          <div
            style={{
              padding: "8px",
              background: "var(--backgroundColor3)",
              borderRadius: "8px"
            }}
          >
            <div>
              <span>Name:</span>
              <input
                className="inputText"
                value={formData.name || ""}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
              />
            </div>
            <div>
              <span>OID:</span>
              <input
                className="inputText"
                value={formData.oid || ""}
                onChange={(e) =>
                  setFormData({ ...formData, oid: e.target.value })
                }
              />
            </div>
            <div>
              <span>Tag:</span>
              <input
                className="inputText"
                value={formData.tag || ""}
                onChange={(e) =>
                  setFormData({ ...formData, tag: e.target.value })
                }
              />
            </div>
          </div>
        )}
      </div>

      {selectedOption && (
        <div className="signalConfigButtonContainer">
          <button
            onClick={handleSave}
            className="buttonStyles saveRuleButton"
          >
            Save
          </button>
          <button
            onClick={handleDelete}
            className="buttonStyles deleteRuleButton"
          >
            Delete
          </button>
          <button
            onClick={handleDeleteAll}
            className="buttonStyles deleteRuleButton"
          >
            Delete All
          </button>
        </div>
      )}
    </div>
  );
}

export default OIDConfig;