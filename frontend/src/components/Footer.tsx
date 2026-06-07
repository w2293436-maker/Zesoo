interface FooterProps {
  onLegalClick?: () => void;
  onAdminClick?: () => void;
  compact?: boolean;
}

export default function Footer({ onLegalClick, onAdminClick, compact = false }: FooterProps) {
  if (compact) {
    return (
      <footer className="py-3 text-center flex-shrink-0">
        <p className="text-[10px] sm:text-xs text-gray-300">
          AI 生成内容仅供参考，不构成专业建议 |{" "}
          <button onClick={onLegalClick} className="underline hover:text-gray-400">
            免责
          </button>
          {onAdminClick && (
            <span>
              {" · "}
              <button onClick={onAdminClick} className="underline hover:text-gray-400">
                数据
              </button>
            </span>
          )}
        </p>
      </footer>
    );
  }

  return (
    <footer className="py-4 sm:py-6 text-center flex-shrink-0 border-t border-gray-100 bg-white">
      <p className="text-xs text-gray-400 mb-1">
        AI 生成内容仅供参考，不构成任何形式的专业建议
      </p>
      <p className="text-xs text-gray-300">
        © 2026 择书Zesoo |{" "}
        <button onClick={onLegalClick} className="underline hover:text-gray-400">
          免责声明
        </button>
        {" · "}
        <button onClick={onLegalClick} className="underline hover:text-gray-400">
          用户协议
        </button>
        {" · "}
        <button onClick={onLegalClick} className="underline hover:text-gray-400">
          隐私政策
        </button>
      </p>
    </footer>
  );
}
