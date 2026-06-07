import { useState } from "react";

type Tab = "disclaimer" | "terms" | "privacy";

interface LegalPageProps {
  onBack: () => void;
}

export default function LegalPage({ onBack }: LegalPageProps) {
  const [tab, setTab] = useState<Tab>("disclaimer");

  const tabs: { key: Tab; label: string }[] = [
    { key: "disclaimer", label: "免责声明" },
    { key: "terms", label: "用户协议" },
    { key: "privacy", label: "隐私政策" },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* 顶栏 */}
      <header className="bg-white border-b border-gray-100 px-4 sm:px-6 py-3 flex items-center gap-3 flex-shrink-0">
        <button
          onClick={onBack}
          className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
        <h1 className="text-sm font-semibold text-gray-800">法律声明</h1>
      </header>

      {/* Tab 切换 */}
      <div className="bg-white border-b border-gray-100 px-4 flex gap-0">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 内容区 */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-8 max-w-3xl mx-auto w-full">
        {tab === "disclaimer" && <DisclaimerContent />}
        {tab === "terms" && <TermsContent />}
        {tab === "privacy" && <PrivacyContent />}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <h2 className="text-base font-bold text-gray-800 mb-3">{title}</h2>
      <div className="text-sm text-gray-600 leading-relaxed space-y-2">{children}</div>
    </section>
  );
}

function DisclaimerContent() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 sm:p-8 shadow-sm">
      <h1 className="text-xl font-bold text-gray-800 mb-6">免责声明</h1>

      <Section title="一、AI 生成内容声明">
        <p>择书Zesoo（以下简称"本工具"）是一个基于人工智能技术的书籍精读报告辅助生成工具。本工具生成的所有内容（包括但不限于章节总结、核心观点、金句摘录、方法论、启示建议等）均由 AI 模型自动生成，<strong>仅供参考和学习交流之用，不构成任何形式的专业建议、指导或承诺</strong>。</p>
        <p>AI 生成的内容可能存在不准确、不完整、过时或与原文存在偏差的情况。用户应自行判断和核实报告内容的准确性和适用性。</p>
      </Section>

      <Section title="二、知识产权声明">
        <p>用户上传的书籍文件及其内容的知识产权归原作者及权利人所有。本工具仅提供文本分析和内容提炼服务，<strong>不对上传文件的内容主张任何权利</strong>。</p>
        <p>AI 生成的精读报告仅供用户个人学习使用。用户不得将生成的报告用于商业目的，亦不得以任何形式公开发布或传播涉及侵权的内容。如用户将报告用于非个人学习目的，由此产生的知识产权纠纷<strong>由用户自行承担全部责任</strong>。</p>
      </Section>

      <Section title="三、责任限制">
        <p><strong>本工具按"现状"提供，不提供任何明示或默示的保证</strong>，包括但不限于对准确性、完整性、可靠性、适用性的保证。</p>
        <p>在任何情况下，本工具的开发者和运营方均不对因使用或无法使用本工具所产生的任何直接、间接、附带、特殊或后果性损失承担责任，包括但不限于：数据丢失、业务中断、信息不准确导致的决策失误等。</p>
        <p>用户明确同意<strong>使用本工具的风险由用户自行承担</strong>。</p>
      </Section>

      <Section title="四、文件安全声明">
        <p>本工具不会主动存储、分享、传播用户上传的文件。文件在上传分析后自动清除。AI 分析过程中，文件内容将传输至第三方 AI 服务商（DeepSeek）的服务器进行处理。</p>
        <p>用户应确保上传的文件不包含敏感个人信息、商业秘密或违法内容。<strong>本工具不对因用户上传违规内容而产生的任何后果承担责任</strong>。</p>
      </Section>

      <Section title="五、服务可用性">
        <p>本工具保留随时修改、暂停或终止服务的权利，无需事先通知。因系统维护、网络故障、第三方服务中断等原因导致的服务不可用，<strong>本工具不承担任何责任</strong>。</p>
      </Section>

      <Section title="六、联系方式">
        <p>如对本工具或本声明有任何疑问、建议或侵权投诉，请联系：<strong>w2293436@gmail.com</strong>，我们会在收到邮件后及时处理。</p>
      </Section>
    </div>
  );
}

function TermsContent() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 sm:p-8 shadow-sm">
      <h1 className="text-xl font-bold text-gray-800 mb-6">用户协议</h1>

      <Section title="一、接受条款">
        <p>使用择书Zesoo（以下简称"本工具"）即表示您已阅读、理解并同意接受本协议的所有条款。如果您不同意本协议的任何条款，请停止使用本工具。</p>
      </Section>

      <Section title="二、用户义务">
        <p>用户在使用本工具时应遵守以下规定：</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>不得上传含有违法、侵权、淫秽、暴力、歧视等违规内容的文件</li>
          <li>不得利用本工具从事任何违法活动</li>
          <li>不得对 AI 生成的报告进行恶意篡改后以本工具名义传播</li>
          <li>不得通过任何方式攻击、干扰或破坏本工具的正常运行</li>
        </ul>
      </Section>

      <Section title="三、账号与使用">
        <p>本工具目前为免费服务，无需注册账号即可使用。未来如推出账号系统，用户需对自身账号的安全性负责。</p>
      </Section>

      <Section title="四、服务变更与终止">
        <p>本工具保留随时修改或终止服务的权利。如用户违反本协议，本工具有权立即终止用户的使用权限。</p>
      </Section>

      <Section title="五、适用法律">
        <p>本协议适用中华人民共和国法律。因本协议产生的任何争议，应通过友好协商解决；协商不成的，提交有管辖权的人民法院裁决。</p>
      </Section>
    </div>
  );
}

function PrivacyContent() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 sm:p-8 shadow-sm">
      <h1 className="text-xl font-bold text-gray-800 mb-6">隐私政策</h1>

      <Section title="一、信息收集">
        <p>本工具<strong>不收集、不存储用户的个人信息</strong>。使用本工具无需注册账号、无需提供姓名、邮箱、手机号等任何个人信息。</p>
      </Section>

      <Section title="二、文件处理">
        <p>用户上传的书籍文件仅在本次会话期间临时处理。分析完成后，服务器上的文件将被自动清除。</p>
        <p>文件内容在 AI 分析过程中会传输至 DeepSeek API 服务器。DeepSeek 的隐私政策详见其官方网站。本工具开发者不对第三方服务的隐私保护承担连带责任。</p>
      </Section>

      <Section title="三、日志数据">
        <p>本工具可能会自动记录服务器运行日志（如请求时间、IP 地址、浏览器类型等），仅用于服务监控和故障排查，不会与任何个人身份信息关联。</p>
      </Section>

      <Section title="四、Cookie">
        <p>本工具不使用 Cookie 追踪用户行为。未来如有必要使用，将更新本政策并告知用户。</p>
      </Section>

      <Section title="五、政策更新">
        <p>本隐私政策可能随时更新，更新后的政策将发布在本页面。继续使用本工具即表示同意更新后的政策。</p>
      </Section>
    </div>
  );
}
