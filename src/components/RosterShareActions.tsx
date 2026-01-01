import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Send, Download, MessageSquare } from 'lucide-react';
import { Driver } from '@/types/driver';
import { normalizePhoneToE164, formatPhoneForDisplay } from '@/lib/phone-utils';
import { useAuth } from '@/hooks/useAuth';

interface RosterShareActionsProps {
  drivers: Driver[];
  selectedDrivers: Driver[];
}

const TELEGRAM_CHAR_LIMIT = 3500;

export function RosterShareActions({ drivers, selectedDrivers }: RosterShareActionsProps) {
  const { isAdmin } = useAuth();
  const [showChunkModal, setShowChunkModal] = useState(false);
  const [messageChunks, setMessageChunks] = useState<string[]>([]);

  const driversToUse = selectedDrivers.length > 0 ? selectedDrivers : drivers;

  const generateContactLines = (): string[] => {
    return driversToUse
      .filter(d => d.phone)
      .map(d => {
        const phone = formatPhoneForDisplay(d.phone);
        return `${d.name} — ${phone}`;
      });
  };

  const splitIntoChunks = (lines: string[]): string[] => {
    const chunks: string[] = [];
    let currentChunk = '';

    for (const line of lines) {
      const lineWithNewline = currentChunk ? '\n' + line : line;
      if ((currentChunk + lineWithNewline).length > TELEGRAM_CHAR_LIMIT) {
        if (currentChunk) chunks.push(currentChunk);
        currentChunk = line;
      } else {
        currentChunk += lineWithNewline;
      }
    }
    if (currentChunk) chunks.push(currentChunk);
    return chunks;
  };

  const handleSendToTelegram = () => {
    const lines = generateContactLines();
    if (lines.length === 0) return;

    const chunks = splitIntoChunks(lines);
    
    if (chunks.length === 1) {
      const encoded = encodeURIComponent(chunks[0]);
      window.open(`https://t.me/share/url?text=${encoded}`, '_blank');
    } else {
      setMessageChunks(chunks);
      setShowChunkModal(true);
    }
  };

  const openTelegramChunk = (index: number) => {
    const encoded = encodeURIComponent(messageChunks[index]);
    window.open(`https://t.me/share/url?text=${encoded}`, '_blank');
  };

  const generateVCard = (): string => {
    const vcards = driversToUse
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

  const handleDownloadVCF = () => {
    const vcfContent = generateVCard();
    if (!vcfContent) return;

    const date = new Date().toISOString().split('T')[0];
    const filename = `taxi-roster-contacts-${date}.vcf`;
    
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

  const validCount = driversToUse.filter(d => d.phone).length;
  const label = selectedDrivers.length > 0 
    ? `${validCount} selected` 
    : `${validCount} contacts`;

  // Only admin users can access contact export features
  if (!isAdmin) {
    return null;
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleSendToTelegram}
          disabled={validCount === 0}
          className="gap-2"
        >
          <Send className="h-4 w-4" />
          <span className="hidden sm:inline">Send to Telegram</span>
          <span className="sm:hidden">Telegram</span>
        </Button>
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

      <Dialog open={showChunkModal} onOpenChange={setShowChunkModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Multiple Messages Required
            </DialogTitle>
            <DialogDescription>
              This list will be sent as {messageChunks.length} messages due to Telegram's character limit.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 mt-4">
            {messageChunks.map((_, index) => (
              <Button
                key={index}
                variant="outline"
                onClick={() => openTelegramChunk(index)}
                className="justify-start gap-2"
              >
                <Send className="h-4 w-4" />
                Open Message {index + 1}
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
