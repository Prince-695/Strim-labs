"use client"

import * as React from "react"
import { Copy, Check, ClipboardPaste } from "lucide-react"

interface OtpInputProps {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  hasError?: boolean
  autoFocus?: boolean
  id?: string
}

export function OtpInput({
  value = "",
  onChange,
  disabled = false,
  hasError = false,
  autoFocus = true,
  id = "otp-input",
}: OtpInputProps) {
  const inputRefs = React.useRef<(HTMLInputElement | null)[]>([])
  const [copied, setCopied] = React.useState(false)

  // Split value into 6 separate character slots
  const digits = React.useMemo(() => {
    const raw = (value || "").replace(/\D/g, "").slice(0, 6)
    const arr = raw.split("")
    while (arr.length < 6) {
      arr.push("")
    }
    return arr
  }, [value])

  // Auto-focus the first slot on mount if requested
  React.useEffect(() => {
    if (autoFocus && !disabled && inputRefs.current[0]) {
      inputRefs.current[0].focus()
    }
  }, [autoFocus, disabled])

  const handleInputChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value
    // If multiple digits were typed/input at once
    const cleaned = inputValue.replace(/\D/g, "")
    if (!cleaned) {
      const nextDigits = [...digits]
      nextDigits[index] = ""
      onChange(nextDigits.join(""))
      return
    }

    if (cleaned.length > 1) {
      // Multiple digits handled like paste
      handleMultiDigitFill(cleaned, index)
      return
    }

    // Single digit input
    const char = cleaned.slice(-1)
    const nextDigits = [...digits]
    nextDigits[index] = char
    const newOtp = nextDigits.join("")
    onChange(newOtp)

    // Move focus to next input
    if (index < 5 && char) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  const handleMultiDigitFill = (chars: string, startIndex: number) => {
    const nextDigits = [...digits]
    const cleanChars = chars.replace(/\D/g, "")
    
    // Fill from startIndex or from 0 if cleanChars is 6 chars
    const start = cleanChars.length === 6 ? 0 : startIndex
    for (let i = 0; i < cleanChars.length && start + i < 6; i++) {
      nextDigits[start + i] = cleanChars[i]
    }

    const newOtp = nextDigits.join("")
    onChange(newOtp)

    const nextFocusIndex = Math.min(start + cleanChars.length, 5)
    inputRefs.current[nextFocusIndex]?.focus()
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      e.preventDefault()
      if (digits[index]) {
        // Clear current box
        const nextDigits = [...digits]
        nextDigits[index] = ""
        onChange(nextDigits.join(""))
      } else if (index > 0) {
        // Clear previous box and move focus back
        const nextDigits = [...digits]
        nextDigits[index - 1] = ""
        onChange(nextDigits.join(""))
        inputRefs.current[index - 1]?.focus()
      }
    } else if (e.key === "Delete") {
      e.preventDefault()
      const nextDigits = [...digits]
      nextDigits[index] = ""
      onChange(nextDigits.join(""))
    } else if (e.key === "ArrowLeft" && index > 0) {
      e.preventDefault()
      inputRefs.current[index - 1]?.focus()
    } else if (e.key === "ArrowRight" && index < 5) {
      e.preventDefault()
      inputRefs.current[index + 1]?.focus()
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const pastedText = e.clipboardData.getData("text").trim()
    const cleanDigits = pastedText.replace(/\D/g, "").slice(0, 6)
    if (!cleanDigits) return

    handleMultiDigitFill(cleanDigits, 0)
  }

  const handleCopy = (e: React.ClipboardEvent) => {
    // If no specific single letter is selected, copy the full 6-digit OTP
    const selection = window.getSelection()?.toString()
    if (!selection) {
      const fullCode = digits.join("")
      if (fullCode) {
        e.clipboardData.setData("text/plain", fullCode)
        e.preventDefault()
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }
    }
  }

  // Quick clipboard button action
  const handleDirectCopy = async () => {
    const fullCode = digits.join("")
    if (!fullCode) return
    try {
      await navigator.clipboard.writeText(fullCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback
    }
  }

  // Quick paste from clipboard button action
  const handleDirectPaste = async () => {
    try {
      const clipText = await navigator.clipboard.readText()
      const cleanDigits = clipText.replace(/\D/g, "").slice(0, 6)
      if (cleanDigits) {
        handleMultiDigitFill(cleanDigits, 0)
      }
    } catch {
      // Clipboard read may require user focus
    }
  }

  return (
    <div className="space-y-3" onPaste={handlePaste} onCopy={handleCopy}>
      {/* 6-box input container */}
      <div className="flex items-center justify-between gap-1.5 sm:gap-2.5">
        {digits.map((digit, index) => {
          const isFilled = Boolean(digit)
          return (
            <input
              key={index}
              ref={(el) => {
                inputRefs.current[index] = el
              }}
              id={`${id}-${index}`}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete={index === 0 ? "one-time-code" : "off"}
              maxLength={1}
              value={digit}
              disabled={disabled}
              onChange={(e) => handleInputChange(index, e)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              aria-label={`Verification digit ${index + 1} of 6`}
              className={`h-12 sm:h-14 w-10 sm:w-12 rounded-lg border text-center font-mono text-xl sm:text-2xl font-bold transition-all outline-hidden select-all ${
                hasError
                  ? "border-danger/80 bg-danger/10 text-danger focus:border-danger focus:ring-1 focus:ring-danger"
                  : isFilled
                  ? "border-border bg-surface-raised text-foreground shadow-sm shadow-black/40 focus:border-brand focus:ring-2 focus:ring-brand/30"
                  : "border-border bg-surface-sunken text-foreground placeholder:text-foreground-subtle focus:border-brand focus:bg-background focus:ring-2 focus:ring-brand/30"
              } disabled:cursor-not-allowed disabled:opacity-50`}
            />
          )
        })}
      </div>

      {/* Copy / Paste Helper Bar */}
      <div className="flex items-center justify-between font-mono text-[11px] text-foreground-subtle px-0.5">
        <span>Enter 6 digits or paste</span>
        <div className="flex items-center gap-3">
          {digits.some(Boolean) && (
            <button
              type="button"
              onClick={handleDirectCopy}
              className="inline-flex items-center gap-1 text-foreground-muted hover:text-foreground transition-colors cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="size-3 text-success" />
                  <span className="text-success">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="size-3" />
                  <span>Copy</span>
                </>
              )}
            </button>
          )}
          <button
            type="button"
            onClick={handleDirectPaste}
            className="inline-flex items-center gap-1 text-foreground-muted hover:text-foreground transition-colors cursor-pointer"
          >
            <ClipboardPaste className="size-3" />
            <span>Paste code</span>
          </button>
        </div>
      </div>
    </div>
  )
}
