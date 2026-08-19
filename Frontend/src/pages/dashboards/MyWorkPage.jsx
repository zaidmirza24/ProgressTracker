import MyWorkPanel from "../../components/dashboards/shared/MyWorkPanel"

// A Manager/Admin's own work — own tasks, timer, daily tasks, capacity, progress —
// as its own sidebar page rather than a tab on the team/org dashboard. Reuses
// MyWorkPanel verbatim, the same component that renders the Employee dashboard.
const MyWorkPage = () => <MyWorkPanel />

export default MyWorkPage
