import useReportsStore from "../../../../store/useReportsStore"
import EntityReportTable from "./EntityReportTable"

const DepartmentsReport = () => {
  const reports = useReportsStore(s => s.reports)
  const { departmentReport } = reports

  return (
    <EntityReportTable
      entityLabel="Department"
      rows={departmentReport}
      getRowId={d => d.deptId}
      barColorClass="bg-green-500"
    />
  )
}

export default DepartmentsReport
