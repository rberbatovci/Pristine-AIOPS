import { useEffect, useState } from 'react';
import Select from 'react-select';

import '../../css/SearchSyslogs.css';
import customStyles from '../misc/SelectStyles';

import { useDevices } from '../../hooks/useDevices';

const FilterDevice = ({ keycloak, onDeviceSelect }) => {
  const [selectedOption, setSelectedOption] = useState(null);

  // Use custom hook
  const { devices, loading, error } = useDevices(keycloak);

  const handleDeviceChange = (option) => {
    setSelectedOption(option);

    // Pass selected hostname to parent
    onDeviceSelect(option?.hostname || null);
  };

  // Reset selection if selected device disappears
  useEffect(() => {
    if (
      selectedOption &&
      !devices.find((d) => d.id === selectedOption.id)
    ) {
      setSelectedOption(null);
    }
  }, [devices, selectedOption]);

  return (
    <div className="searchSyslogsContainer">
      <div className="searchSyslogsFilterEntries">
        <span className="searchSignalFilterText">
          Device:
        </span>

        <div style={{ marginTop: '6px' }}>
          <Select
            options={devices}
            value={selectedOption}
            onChange={handleDeviceChange}
            placeholder={
              loading
                ? 'Loading devices...'
                : 'Select device'
            }
            isClearable
            isLoading={loading}
            noOptionsMessage={() => {
              if (loading) return 'Loading...';
              if (error) return 'Failed to load devices';
              return 'No devices found';
            }}
            getOptionLabel={(option) =>
              `${option.hostname} (${option.ip_address})`
            }
            getOptionValue={(option) => option.id}
            styles={{
              ...customStyles('380px'),
              menuPortal: (base) => ({
                ...base,
                zIndex: 9999
              })
            }}
            menuPortalTarget={document.body}
          />
        </div>
      </div>
    </div>
  );
};

export default FilterDevice;