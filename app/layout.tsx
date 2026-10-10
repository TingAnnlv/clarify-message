import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
 title: "Clarify Message — 让重要的事，浮出消息",
 description: "把工作消息整理成有原文依据的行动建议，核对截止日期，安排提醒。",
 icons: {icon:"/favicon.svg",shortcut:"/favicon.svg"},
};
export default function RootLayout({children}:{children:React.ReactNode}){
 return <html lang="zh-CN"><body>{children}</body></html>;
}