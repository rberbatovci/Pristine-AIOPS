import React, { useState } from 'react';

const Filters = ({ setFilters }) => {
  const [localFilters, setLocalFilters] = useState({
    state: '',
    signalSource: '',
    rootCause: ''
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setLocalFilters((prev) => ({ ...prev, [name]: value }));
  };

  const applyFilters = () => {
    setFilters(localFilters);
  };

  return (
    <div className="signal-filter">
      <div>
        <label htmlFor="state">State:</label>
        <input
          type="text"
          id="state"
          name="state"
          value={localFilters.state}
          onChange={handleInputChange}
        />
      </div>
      <div>
        <label htmlFor="signalSource">Signal Source:</label>
        <input
          type="text"
          id="signalSource"
          name="signalSource"
          value={localFilters.signalSource}
          onChange={handleInputChange}
        />
      </div>
      <div>
        <label htmlFor="rootCause">Root Cause:</label>
        <input
          type="text"
          id="rootCause"
          name="rootCause"
          value={localFilters.rootCause}
          onChange={handleInputChange}
        />
      </div>
      <div>
        <label htmlFor="rootCause">VRF:</label>
        <input
          type="text"
          id="VRF"
          name="VRF"
          value={localFilters.VRF}
          onChange={handleInputChange}
        />
      </div>
      <div>
        <label htmlFor="rootCause">ASN:</label>
        <input
          type="text"
          id="ASN"
          name="ASN"
          value={localFilters.ASN}
          onChange={handleInputChange}
        />
      </div>
      <div>
        <label htmlFor="rootCause">Root Cause:</label>
        <input
          type="text"
          id="rootCause"
          name="rootCause"
          value={localFilters.rootCause}
          onChange={handleInputChange}
        />
      </div>
      <button onClick={applyFilters}>Apply Filters</button>
    </div>
  );
};

export default Filters;
