import { Plus, Play } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import WalkInTicketCard, { type WalkInTicket } from './WalkInTicketCard';

interface WalkInQueueCardProps {
  tickets: WalkInTicket[];
  avgWaitTime?: string;
  onAddWalkIn: () => void;
  onCallNext: () => void;
  onAssignStaff: (ticket: WalkInTicket) => void;
  onDeleteTicket: (ticketId: string) => void;
}

export default function WalkInQueueCard({
  tickets,
  avgWaitTime = '18 Mins',
  onAddWalkIn,
  onCallNext,
  onAssignStaff,
  onDeleteTicket,
}: WalkInQueueCardProps) {
  const waitingCount = tickets.length;

  return (
    <div className="bg-[#171717] border border-[#2C2C2C] rounded-xl p-5 shadow-sm hover:border-[#E86A33]/40 transition-colors flex flex-col justify-between h-fit">
      <div>
        {/* Header: Title + Count Pill */}
        <div className="flex items-center justify-between gap-3 mb-4">
          <h3 className="font-display font-semibold text-lg text-[#F5F5F5]">
            Walk-In Queue
          </h3>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#35B86B]/15 text-[#35B86B] border border-[#35B86B]/30">
            {waitingCount} Waiting
          </span>
        </div>

        {/* Action Buttons: Side by side */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <Button
            type="button"
            variant="outline"
            onClick={onAddWalkIn}
            className="!py-2.5 !px-3 !text-xs sm:!text-sm !text-[#F5F5F5] !border-[#2C2C2C] hover:!border-[#E86A33] hover:!text-[#E86A33] flex items-center justify-center gap-1.5"
          >
            <Plus className="w-4 h-4 text-[#E86A33] shrink-0" />
            <span className="truncate">+ Add Walk-in</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={onCallNext}
            disabled={waitingCount === 0}
            className="!py-2.5 !px-3 !text-xs sm:!text-sm !text-[#F5F5F5] !border-[#2C2C2C] hover:!border-[#35B86B] hover:!text-[#35B86B] disabled:!text-[#71717A] disabled:!border-[#2C2C2C] flex items-center justify-center gap-1.5"
          >
            <Play className="w-3.5 h-3.5 text-[#35B86B] fill-[#35B86B] shrink-0" />
            <span>Next</span>
          </Button>
        </div>

        {/* Stacked ticket sub-cards */}
        <div className="flex flex-col gap-3">
          {tickets.length > 0 ? (
            tickets.map((ticket, index) => (
              <WalkInTicketCard
                key={ticket.id}
                ticket={ticket}
                position={index + 1}
                onAssign={onAssignStaff}
                onDelete={onDeleteTicket}
              />
            ))
          ) : (
            <div className="bg-[#101010] border border-[#2C2C2C] rounded-lg p-6 text-center text-sm text-[#71717A]">
              No walk-in vehicles in queue
            </div>
          )}
        </div>
      </div>

      {/* Footer row inside the card */}
      <div className="flex items-center justify-between border-t border-[#2C2C2C] pt-3 mt-4 text-sm">
        <span className="text-[#A1A1AA]">Avg Wait Time</span>
        <span className="text-[#F5F5F5] font-semibold">{avgWaitTime}</span>
      </div>
    </div>
  );
}
