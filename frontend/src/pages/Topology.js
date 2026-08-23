import React, { useState, useEffect } from 'react';
import GeolocationMap from '../components/geolocation/GeolocationMap';
import '../css/Topology.css';

import { FaRegMap } from "react-icons/fa6";
import { FaMap } from "react-icons/fa";
import { TfiLayoutListThumb, TfiLayoutListThumbAlt } from "react-icons/tfi";

import { useBGPLinks } from '../hooks/useBGPLinks.js';
import { useBGPNodes } from '../hooks/useBGPNodes.js';
import { useBGPPrefixes } from '../hooks/useBGPPrefixes.js';

import EventsTable from '../components/misc/EventsTable';

function Topology({ keycloak, currentUser, setDashboardTitle }) {
  const [locations, setLocations] = useState([]);
  const [view, setView] = useState('list');

  // Hooks
  const {
    bgpLinks = [],
    loading: bgpLinksLoading,
    reload: reloadBGPLinks
  } = useBGPLinks(keycloak);

  const {
    bgpNodes = [],
    loading: bgpNodesLoading,
    reload: reloadBGPNodes
  } = useBGPNodes(keycloak);

  const {
    bgpPrefixes = [],
    loading: bgpPrefixesLoading,
    reload: reloadBGPPrefixes
  } = useBGPPrefixes(keycloak);

  // Combined loading
  const loading = bgpLinksLoading || bgpNodesLoading || bgpPrefixesLoading;

  // Column definitions
  const baseColumns = {
    links: [
      { label: 'Local Router', value: 'local' },
      { label: 'Remote Router', value: 'remote' },
    ],
    nodes: [
      { label: 'ASN', value: 'asn' },
      { label: 'Router ID', value: 'router_id' },
      { label: 'Pseudonode', value: 'pseudonode' },
    ],
    prefixes: [
      { label: 'Node', value: 'node' },
      { label: 'Prefixes', value: 'prefixes' },
    ],
  };

  // Title
  useEffect(() => {
    setDashboardTitle("Topology Dashboard");
    return () => setDashboardTitle('');
  }, [setDashboardTitle]);

  // 🔥 Load ALL datasets once
  useEffect(() => {
    reloadBGPPrefixes();
    reloadBGPNodes();
    reloadBGPLinks();
  }, []);

  // Toggle view
  const toggleView = () => {
    setView(prev => (prev === "list" ? "geo" : "list"));
  };

  const handleRowSelectChange = (newSelectedRows) => {
    console.log("Selected rows:", newSelectedRows);
  };

  return (
    <div>
  
      {/* CONTENT */}
      <div className="mainContainerContent">
        {loading && <div>Loading topology...</div>}

        {!loading && (
          <>
            {view === 'list' && (
              <div className="syslogsTableContainer" style={{ padding: '20px'}}>

                {/* PREFIXES */}
                <div className="mainContainer" style={{ width: '500px', marginRight: '20px' }}>
                  <h2 className="tableTitle">Prefixes</h2>
                  {bgpPrefixes.length === 0 ? (
                    <div>No prefixes data available</div>
                  ) : (
                    <EventsTable
                      dataSource="prefixes"
                      data={bgpPrefixes}
                      tags={baseColumns.prefixes}
                      onRowSelectChange={handleRowSelectChange}
                    />
                  )}
                </div>

                {/* NODES */}
                <div className="mainContainer" style={{ width: '600px', marginRight: '20px' }}>
                  <h2 className="tableTitle">Nodes</h2>
                  {bgpNodes.length === 0 ? (
                    <div>No nodes data available</div>
                  ) : (
                    <EventsTable
                      dataSource="nodes"
                      data={bgpNodes}
                      tags={baseColumns.nodes}
                      onRowSelectChange={handleRowSelectChange}
                    />
                  )}
                </div>

                {/* LINKS */}
                <div className="mainContainer" style={{ width: '500px' }}>
                  <h2 className="tableTitle">Links</h2>

                  {bgpLinks.length === 0 ? (
                    <div>No links data available</div>
                  ) : (
                    <EventsTable
                      dataSource="links"
                      data={bgpLinks}
                      tags={baseColumns.links}
                      onRowSelectChange={handleRowSelectChange}
                    />
                  )}
                </div>
              </div>
            )}

            {view === 'geo' && (
              <div className="syslogsTableContainer">
                <GeolocationMap locations={locations} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default Topology;