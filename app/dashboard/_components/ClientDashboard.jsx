"use client";

import React from "react";
import WelcomeBanner from "./WelcomeBanner";
import CourseList from "./CourseList";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Presentation } from "lucide-react";

function ClientDashboard() {
  return (
    <div>
      <WelcomeBanner />
      <div className="flex flex-wrap gap-2 mt-4 sm:hidden">
        <Link href="/create" className="flex-1 min-w-0">
          <Button className="w-full">+&nbsp;Create New</Button>
        </Link>
        <Link href="/dashboard/create-presentation" className="flex-1 min-w-0">
          <Button variant="outline" className="w-full">
            <Presentation className="w-4 h-4 mr-1" />
            Presentation
          </Button>
        </Link>
        <Link href="/dashboard/upgrade" className="flex-1 min-w-0">
          <Button variant="outline" className="w-full">Upgrade</Button>
        </Link>
      </div>
      <CourseList />
    </div>
  );
}

export default ClientDashboard;
