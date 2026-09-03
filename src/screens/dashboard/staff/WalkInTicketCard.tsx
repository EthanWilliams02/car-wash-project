import { User, Trash2 } from 'lucide-react';
import { Button } from '../../../components/ui/Button';

export interface WalkInTicket {
  id: string;
  ticketNumber: string;
  vehicle: string;
  assignedStaff?: string;
  notes?: string;
  timeWaiting?: string;
}

interface WalkInTicketCardProps {
  ticket: WalkInTicket;
  position: number;
  onAssign: (ticket: WalkInTicket) => void;
  onDelete: (ticketId: string) => void;
}

export default function WalkInTicketCard({
  ticket,
  position,
  onAssign,
  onDelete,
}: WalkInTicketCardProps) {
  return (
    <div className="bg-[#101010] border border-[#2C2C2C] rounded-lg p-3 flex flex-col gap-3 transition-colors hover:border-[#2C2C2C]/80">
      {/* Top row: Ticket number, position pill, trash button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-semibold text-[#F5F5F5]">
            {ticket.ticketNumber}
          </span>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[#1F1F1F] text-[#A1A1AA] border border-[#2C2C2C]">
            Pos {position}
          </span>
        </div>

        <button
          type="button"
          onClick={() => onDelete(ticket.id)}
          className="p-1 text-[#71717A] hover:text-red-500 transition-colors rounded hover:bg-[#1F1F1F]"
          title="Remove ticket"
          aria-label="Remove ticket"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Vehicle model */}
      <div className="text-[#F5F5F5] font-medium text-sm">
        {ticket.vehicle}
      </div>

      {/* Assignee row with User icon */}
      <div className="flex items-center gap-2 text-xs text-[#A1A1AA]">
        <div className="w-5 h-5 rounded-full bg-[#1F1F1F] flex items-center justify-center overflow-hidden border border-[#2C2C2C] shrink-0">
          <User className="w-3 h-3 text-[#E86A33]" />
        </div>
        <span className="truncate">
          {ticket.assignedStaff ? `Assigned to ${ticket.assignedStaff}` : 'Unassigned'}
        </span>
      </div>

      {/* Full-width Assign Staff Button */}
      <Button
        variant="outline"
        fullWidth
        onClick={() => onAssign(ticket)}
        className="!py-2 !px-3 !text-xs !text-[#F5F5F5] !border-[#2C2C2C] hover:!border-[#E86A33] hover:!text-[#E86A33]"
      >
        {ticket.assignedStaff ? 'Change Staff' : 'Assign Staff'}
      </Button>
    </div>
  );
}
