import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "../ui/toggle-group";

export default function OrderPanel() {
  return (
    // <div>
    <Tabs defaultValue="market" className="w-md">
      <TabsList className="w-full">
        <TabsTrigger value="market">Market</TabsTrigger>
        <TabsTrigger value="limit">Limit</TabsTrigger>
      </TabsList>
      <TabsContent value="market" className="flex flex-col space-y-2">
        <Input type="number" placeholder="Quantity" />
        <Input type="number" />
      </TabsContent>

      <TabsContent value="limit">limit</TabsContent>
    </Tabs>

    //   {/* <ToggleGroup type="single">
    //     <ToggleGroupItem variant="outline" value="market">
    //       Market
    //     </ToggleGroupItem>
    //     <ToggleGroupItem variant="outline" value="limit">
    //       Limit
    //     </ToggleGroupItem>
    //     <ToggleGroupItem variant="outline" value="stop">
    //       Stop
    //     </ToggleGroupItem>
    //   </ToggleGroup> */}
    // {/* </div> */}
  );
}
