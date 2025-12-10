import { Helmet } from "react-helmet-async";
import Navbar from "@/components/landing/Navbar";
import Hero from "@/components/landing/Hero";
import Features from "@/components/landing/Features";
import HowItWorks from "@/components/landing/HowItWorks";
import DashboardPreview from "@/components/landing/DashboardPreview";
import CTA from "@/components/landing/CTA";
import Footer from "@/components/landing/Footer";

const Index = () => {
  return (
    <>
      <Helmet>
        <title>DocLayer - Turn Your Google Docs into Trusted Knowledge</title>
        <meta 
          name="description" 
          content="The knowledge layer for Google Drive. Organize, govern, and publish your existing docs—without migration, uploads, or duplication. Built for Google Workspace." 
        />
        <meta property="og:title" content="DocLayer - Google Drive-Native Knowledge Platform" />
        <meta property="og:description" content="Turn your Google Docs into trusted, organized knowledge. No migrations. No uploads. Just structure and trust." />
        <link rel="canonical" href="https://doclayer.io" />
      </Helmet>

      <div className="min-h-screen bg-background">
        <Navbar />
        <main>
          <Hero />
          <Features />
          <HowItWorks />
          <DashboardPreview />
          <CTA />
        </main>
        <Footer />
      </div>
    </>
  );
};

export default Index;
