import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Download } from 'lucide-react';
import { Driver } from '@/types/driver';
import { normalizePhoneToE164 } from '@/lib/phone-utils';
import { useAuth } from '@/hooks/useAuth';

interface RosterShareActionsProps {
  drivers: Driver[];
  selectedDrivers: Driver[];
}

const VCF_BATCH_SIZE = 100;

export function RosterShareActions({ drivers, selectedDrivers }: RosterShareActionsProps) {
  const { isAdmin } = useAuth();
  const [showVcfBatchModal, setShowVcfBatchModal] = useState(false);

  const driversToUse = selectedDrivers.length > 0 ? selectedDrivers : drivers;
  const driversWithPhone = driversToUse.filter(d => d.phone);

  const generateVCard = (driversSubset: Driver[]): string => {
    const vcards = driversSubset
      .filter(d => d.phone)
      .map(d => {
        const phone = normalizePhoneToE164(d.phone);
        const telegramPhone = d.telegram_phone ? normalizePhoneToE164(d.telegram_phone) : null;
        
        let vcard = `BEGIN:VCARD\nVERSION:3.0\nFN:${d.name}\nN:${d.name};;;;\n`;
        if (phone) vcard += `TEL;TYPE=CELL:${phone}\n`;
        if (telegramPhone && telegramPhone !== phone) {
          vcard += `TEL;TYPE=CELL;PREF=0:${telegramPhone}\n`;
        }
        vcard += `END:VCARD`;
        return vcard;
      });

    return vcards.join('\n');
  };

  const downloadVcfBatch = (startIndex: number, endIndex: number) => {
    const batchDrivers = driversWithPhone.slice(startIndex, endIndex);
    const vcfContent = generateVCard(batchDrivers);
    if (!vcfContent) return;

    const date = new Date().toISOString().split('T')[0];
    const filename = `taxi-roster-contacts-${startIndex + 1}-${Math.min(endIndex, driversWithPhone.length)}-${date}.vcf`;
    
    const blob = new Blob([vcfContent], { type: 'text/vcard;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadVCF = () => {
    if (driversWithPhone.length === 0) return;

    if (driversWithPhone.length <= VCF_BATCH_SIZE) {
      downloadVcfBatch(0, driversWithPhone.length);
    } else {
      setShowVcfBatchModal(true);
    }
  };

  const getVcfBatches = () => {
    const batches: { start: number; end: number; label: string }[] = [];
    const total = driversWithPhone.length;
    
    for (let i = 0; i < total; i += VCF_BATCH_SIZE) {
      const start = i;
      const end = Math.min(i + VCF_BATCH_SIZE, total);
      batches.push({
        start,
        end,
        label: `${start + 1} - ${end}`
      });
    }
    return batches;
  };

  const validCount = driversWithPhone.length;
  const label = selectedDrivers.length > 0 
    ? `${validCount} selected` 
    : `${validCount} contacts`;

  if (!isAdmin) {
    return null;
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleDownloadVCF}
          disabled={validCount === 0}
          className="gap-2"
        >
          <Download className="h-4 w-4" />
          <span className="hidden sm:inline">Download VCF</span>
          <span className="sm:hidden">VCF</span>
        </Button>
        <span className="text-xs text-muted-foreground hidden md:inline">
          ({label})
        </span>
      </div>

      <Dialog open={showVcfBatchModal} onOpenChange={setShowVcfBatchModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Download Contacts
            </DialogTitle>
            <DialogDescription>
              {driversWithPhone.length} contacts will be downloaded in batches of {VCF_BATCH_SIZE}.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 mt-4 max-h-64 overflow-y-auto">
            {getVcfBatches().map((batch, index) => (
              <Button
                key={index}
                variant="outline"
                onClick={() => downloadVcfBatch(batch.start, batch.end)}
                className="justify-start gap-2"
              >
                <Download className="h-4 w-4" />
                Contacts {batch.label}
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
