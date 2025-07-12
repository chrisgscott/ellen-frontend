import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ImproveUSPosition } from "@/components/opportunities/improve-us-position"
import { DenyAdversaryPosition } from "@/components/opportunities/deny-adversary-position"
import { MakeMoney } from "@/components/opportunities/make-money"
import { CornerNascentMarkets } from "@/components/opportunities/corner-nascent-markets"
import { CustomOpportunities } from "@/components/opportunities/custom-opportunities"

export default function Page() {
  return (
    <div className="flex-1 space-y-4 p-4 pt-6 md:p-8">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Opportunities</h2>
      </div>
      <Tabs defaultValue="improve-us-position" className="space-y-4">
        <TabsList>
          <TabsTrigger value="improve-us-position">Improve US Position</TabsTrigger>
          <TabsTrigger value="deny-adversary-position">Deny Adversary Position</TabsTrigger>
          <TabsTrigger value="make-money">Make Money</TabsTrigger>
          <TabsTrigger value="corner-nascent-markets">Corner Nascent Markets</TabsTrigger>
          <TabsTrigger value="custom">Custom</TabsTrigger>
        </TabsList>
        <TabsContent value="improve-us-position">
          <ImproveUSPosition />
        </TabsContent>
        <TabsContent value="deny-adversary-position">
          <DenyAdversaryPosition />
        </TabsContent>
        <TabsContent value="make-money">
          <MakeMoney />
        </TabsContent>
        <TabsContent value="corner-nascent-markets">
          <CornerNascentMarkets />
        </TabsContent>
        <TabsContent value="custom">
          <CustomOpportunities />
        </TabsContent>
      </Tabs>
    </div>
  )
}
