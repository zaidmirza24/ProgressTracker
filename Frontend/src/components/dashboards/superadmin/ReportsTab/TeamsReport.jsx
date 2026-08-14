import useReportsStore from "../../../../store/useReportsStore"
import EntityReportTable from "./EntityReportTable"

const TeamsReport = () => {
  const reports = useReportsStore(s => s.reports)
  const { teamReport } = reports

  return (
    <EntityReportTable
      entityLabel="Team"
      rows={teamReport}
      getRowId={t => t.teamId}
      barColorClass="bg-primary"
    />
  )
}

export default TeamsReport
