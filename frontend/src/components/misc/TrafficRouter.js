// pages/TrafficRouter.jsx

import { useParams } from "react-router-dom";

import TrafficTable from "../netflow/Table";
import TrafficStatistics from "../netflow/Statistics";

export default function TrafficRouter(props) {
  const { view } = useParams();

  return view === "statistics"
    ? <TrafficStatistics {...props} />
    : <TrafficTable {...props} />;
}