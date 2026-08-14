import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CATEGORY_PRESETS } from "../../lib/taskConstants"

// The category-with-custom-option select and priority select were byte-for-byte
// identical between Manager's and Employee's CreateTaskModal (only the surrounding
// form differs — assignee/department/capacity fields are Manager-only). Extracted
// here so both keep using the exact same markup/behavior from one place.
export const CategorySelect = ({ category, customActive, onSelectChange, onCustomTextChange, idPrefix = "task" }) => (
  <>
    <div className="space-y-1.5 flex flex-col">
      <Label htmlFor={`${idPrefix}-cat`} className="mb-1 text-foreground/80 font-medium">Category</Label>
      <Select
        value={customActive ? "custom" : (CATEGORY_PRESETS.includes(category) ? category : "General")}
        onValueChange={onSelectChange}
      >
        <SelectTrigger className="h-10 rounded-lg">
          <SelectValue placeholder="Select Category" />
        </SelectTrigger>
        <SelectContent>
          {CATEGORY_PRESETS.map(cat => (
            <SelectItem key={cat} value={cat}>{cat}</SelectItem>
          ))}
          <SelectItem value="custom">Custom...</SelectItem>
        </SelectContent>
      </Select>
    </div>
    {customActive && (
      <div className="space-y-1.5 animate-in fade-in duration-200 col-span-2">
        <Label htmlFor={`${idPrefix}-cat-custom`} className="text-foreground/80 font-medium">Custom Category Name *</Label>
        <Input
          id={`${idPrefix}-cat-custom`}
          value={category}
          onChange={e => onCustomTextChange(e.target.value)}
          placeholder="Enter custom category..."
          className="h-10 rounded-lg"
          required
        />
      </div>
    )}
  </>
)

export const PrioritySelect = ({ priority, onChange, idPrefix = "task" }) => (
  <div className="space-y-1.5 flex flex-col">
    <Label htmlFor={`${idPrefix}-priority`} className="mb-1 text-foreground/80 font-medium">Priority</Label>
    <Select value={priority} onValueChange={onChange}>
      <SelectTrigger className="h-10 rounded-lg">
        <SelectValue placeholder="Select Priority" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="low">
          <span className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500"></span> Low
          </span>
        </SelectItem>
        <SelectItem value="medium">
          <span className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-amber-500"></span> Medium
          </span>
        </SelectItem>
        <SelectItem value="high">
          <span className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-rose-500"></span> High
          </span>
        </SelectItem>
      </SelectContent>
    </Select>
  </div>
)

export const HoursAndDueDateRow = ({ estimatedHours, dueDate, onHoursChange, onDueDateChange, idPrefix = "task" }) => (
  <div className="grid grid-cols-2 gap-4">
    <div className="space-y-1.5">
      <Label htmlFor={`${idPrefix}-hours`} className="text-foreground/80 font-medium">Estimated Hours</Label>
      <Input
        type="number"
        id={`${idPrefix}-hours`}
        value={estimatedHours}
        onChange={e => onHoursChange(Number(e.target.value))}
        min="0"
        className="h-10 rounded-lg"
      />
    </div>
    <div className="space-y-1.5">
      <Label htmlFor={`${idPrefix}-due`} className="text-foreground/80 font-medium">Due Date</Label>
      <Input
        type="date"
        id={`${idPrefix}-due`}
        value={dueDate}
        onChange={e => onDueDateChange(e.target.value)}
        className="h-10 rounded-lg text-foreground bg-transparent"
      />
    </div>
  </div>
)
