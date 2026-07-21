"use client";

import { useState } from "react";
import { Phone, MapPin, Clock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { saveMessage, type SiteSettings } from "@/lib/firebase";
import { waLink } from "@/lib/whatsapp";
import { SectionHead } from "@/components/storefront/section-head";

export function ContactForm({ settings }: { settings: SiteSettings }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !message.trim()) return;
    setStatus("sending");
    try {
      await saveMessage({ name: name.trim(), phone: phone.trim(), message: message.trim() });
    } catch (err) {
      console.error("[DS] saveMessage", err);
    }
    setStatus("sent");
    if (settings.waEnabled !== false) {
      const text = `مرحباً، اسمي ${name}${phone ? `\nهاتف: ${phone}` : ""}\n\n${message}`;
      window.open(waLink(settings, text), "_blank");
    }
    setName("");
    setPhone("");
    setMessage("");
  }

  return (
    <section id="contact" className="reveal mx-auto max-w-[1320px] px-5 py-22 md:px-12">
      <SectionHead label="تواصلي معنا" title="نحن هنا لمساعدتكِ" />
      <div className="mx-auto grid max-w-[1100px] grid-cols-1 gap-10 md:grid-cols-2">
        <div>
          <div className="mb-6 flex gap-4 border-b border-border pb-6">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--rose-tint)] text-[var(--rose-deep)]">
              <Phone className="size-5.5" />
            </div>
            <div>
              <div className="mb-1 text-[0.66rem] font-extrabold tracking-[1.5px] text-[var(--gold)] uppercase">
                واتساب / هاتف
              </div>
              <div className="text-[0.92rem] text-foreground">
                <span className="ltr">+213 662 705 830</span>
              </div>
            </div>
          </div>
          <div className="mb-6 flex gap-4 border-b border-border pb-6">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--rose-tint)] text-[var(--rose-deep)]">
              <MapPin className="size-5.5" />
            </div>
            <div>
              <div className="mb-1 text-[0.66rem] font-extrabold tracking-[1.5px] text-[var(--gold)] uppercase">
                التوصيل
              </div>
              <div className="text-[0.92rem] text-foreground">إلى كل ولايات الجزائر — 58 ولاية</div>
            </div>
          </div>
          <div className="mb-6 flex gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--rose-tint)] text-[var(--rose-deep)]">
              <Clock className="size-5.5" />
            </div>
            <div>
              <div className="mb-1 text-[0.66rem] font-extrabold tracking-[1.5px] text-[var(--gold)] uppercase">
                ساعات العمل
              </div>
              <div className="text-[0.92rem] text-foreground">كل أيام الأسبوع · 9:00 ص — 9:00 م</div>
            </div>
          </div>
          {settings.waEnabled !== false && (
            <a
              href={waLink(settings, "مرحباً، أريد الاستفسار عن منتجاتكم")}
              target="_blank"
              rel="noopener"
              className="mt-2 inline-flex items-center gap-2 rounded-full bg-gradient-to-br from-[#1A7A34] to-[#25D366] px-9 py-4 text-[0.92rem] font-extrabold text-white shadow-[0_8px_25px_rgba(37,211,102,.4)]"
            >
              تواصلي عبر واتساب
            </a>
          )}
        </div>

        <form onSubmit={handleSubmit} className="rounded-[22px] border border-[var(--line-2)] bg-card p-8 shadow-[var(--shadow)]">
          <div className="mb-4">
            <label className="mb-2 block text-[0.74rem] font-extrabold text-[var(--ink-2)]">الاسم الكامل</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="اسمكِ الكريم" />
          </div>
          <div className="mb-4">
            <label className="mb-2 block text-[0.74rem] font-extrabold text-[var(--ink-2)]">رقم الهاتف</label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" placeholder="0X XX XX XX XX" className="text-right" dir="ltr" />
          </div>
          <div className="mb-4">
            <label className="mb-2 block text-[0.74rem] font-extrabold text-[var(--ink-2)]">رسالتكِ</label>
            <Textarea value={message} onChange={(e) => setMessage(e.target.value)} required placeholder="كيف يمكننا مساعدتكِ؟" />
          </div>
          <Button type="submit" disabled={status === "sending"} className="w-full rounded-full" size="lg">
            {status === "sent" ? "تم الإرسال ✓" : status === "sending" ? "جارٍ الإرسال..." : "إرسال الرسالة"}
          </Button>
        </form>
      </div>
    </section>
  );
}
