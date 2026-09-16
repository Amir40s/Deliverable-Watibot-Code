import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

export default function DesignSystemPage() {
 return (
 <div className="p-8 max-w-6xl mx-auto space-y-12 bg-background min-h-screen">
 <section className="space-y-4">
 <h1 className="wise-display-mega text-foreground">Wise Design System</h1>
 <p className="wise-body text-muted-foreground max-w-2xl">
 A bold, confident fintech platform that communicates "money without borders" through massive typography and a distinctive lime-green accent.
 </p>
 </section>

 <section className="space-y-8">
 <h2 className="wise-heading-section text-foreground">Typography</h2>
 <div className="space-y-6">
 <div className="space-y-1">
 <p className="text-sm text-muted-foreground">wise-display-mega (126px, 900, 0.85)</p>
 <h1 className="wise-display-mega">Money without borders</h1>
 </div>
 <div className="space-y-1">
 <p className="text-sm text-muted-foreground">wise-display-hero (96px, 900, 0.85)</p>
 <h2 className="wise-display-hero">The world's most international account</h2>
 </div>
 <div className="space-y-1">
 <p className="text-sm text-muted-foreground">wise-heading-section (64px, 900, 0.85)</p>
 <h3 className="wise-heading-section">Send money cheaper</h3>
 </div>
 <div className="space-y-1">
 <p className="text-sm text-muted-foreground">wise-body (18px, 600, 1.44)</p>
 <p className="wise-body">
 This is the default body text. It's confident, semibold, and easy to read.
 Inter serves as the body font with weight 600 as the default for emphasis.
 </p>
 </div>
 </div>
 </section>

 <section className="space-y-8">
 <h2 className="wise-heading-section text-foreground">Buttons</h2>
 <div className="flex flex-wrap gap-4 items-end">
 <div className="space-y-2">
 <p className="text-sm text-muted-foreground">Primary Green Pill</p>
 <Button variant="default" size="default">Open an account</Button>
 </div>
 <div className="space-y-2">
 <p className="text-sm text-muted-foreground">Secondary Subtle Pill</p>
 <Button variant="secondary" size="default">Learn more</Button>
 </div>
 <div className="space-y-2">
 <p className="text-sm text-muted-foreground">Large Primary</p>
 <Button variant="default" size="lg">Send money now</Button>
 </div>
 <div className="space-y-2">
 <p className="text-sm text-muted-foreground">Small Outline</p>
 <Button variant="outline" size="sm">Help</Button>
 </div>
 </div>
 </section>

 <section className="space-y-8">
 <h2 className="wise-heading-section text-foreground">Cards</h2>
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
 <Card>
 <CardHeader>
 <CardTitle>Debit card</CardTitle>
 </CardHeader>
 <CardContent>
 <p className="wise-body">
 Spend in local currencies around the world with our international debit card.
 </p>
 </CardContent>
 <CardFooter>
 <Button variant="outline" size="sm">Order yours</Button>
 </CardFooter>
 </Card>

 <Card className="border-primary border-2">
 <CardHeader>
 <CardTitle>Business account</CardTitle>
 </CardHeader>
 <CardContent>
 <p className="wise-body">
 The international business account for everyone. From solo-traders to enterprises.
 </p>
 </CardContent>
 <CardFooter>
 <Button variant="default" size="sm">Get started</Button>
 </CardFooter>
 </Card>

 <Card>
 <CardHeader>
 <CardTitle>Assets</CardTitle>
 </CardHeader>
 <CardContent>
 <p className="wise-body">
 Invest in stocks or hold your money as interest-earning assets.
 </p>
 </CardContent>
 <CardFooter>
 <Button variant="secondary" size="sm">Explore</Button>
 </CardFooter>
 </Card>
 </div>
 </section>

 <section className="space-y-8 pb-20">
 <h2 className="wise-heading-section text-foreground">Form Elements</h2>
 <div className="max-w-md space-y-4">
 <div className="space-y-2">
 <label className="text-sm font-semibold text-foreground">Email address</label>
 <Input type="email" placeholder="you@example.com" />
 </div>
 <div className="space-y-2">
 <label className="text-sm font-semibold text-foreground">Amount to send</label>
 <div className="flex gap-2">
 <Input type="number" placeholder="1,000" />
 <Button variant="default">GBP</Button>
 </div>
 </div>
 </div>
 </section>
 </div>
 )
}
