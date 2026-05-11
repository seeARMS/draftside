interface EditorFooterProps {
  wordCount: number;
  charCount: number;
}

export function EditorFooter({ wordCount, charCount }: EditorFooterProps) {
  return (
    <footer className="flex min-h-10 items-center justify-end border-t border-border/70 bg-card px-3.5" aria-label="Editor status">
      <div className="inline-flex items-center gap-2.5 whitespace-nowrap text-xs leading-4 text-muted-foreground" aria-live="polite">
        <span>{wordCount} words</span>
        <span>{charCount} chars</span>
        <a
          href="https://github.com/seeARMS/draftside"
          target="_blank"
          rel="noopener noreferrer"
          className="ml-0.5 inline-flex items-center text-muted-foreground opacity-75 transition hover:text-foreground hover:opacity-100 focus-visible:text-foreground focus-visible:opacity-100"
          aria-label="View source on GitHub"
          title="View source on GitHub"
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
            <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
          </svg>
        </a>
      </div>
    </footer>
  );
}
