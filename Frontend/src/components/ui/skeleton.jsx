const Skeleton = ({ className = "", ...props }) => (
  <div
    className={`skeleton ${className}`}
    {...props}
  />
)

export { Skeleton }
