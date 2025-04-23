"use client";

import { useFieldArray, useForm } from "react-hook-form";
import { FormField } from "../ui/form";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "../ui/toggle-group";
import { Button } from "../ui/button";
import { Separator } from "../ui/separator";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";

interface OrderForm {
  quantity: number;
  entries: { price: number | null }[];
  stopPrice: number;
  limitPrice: number;
}

export default function OrderPanel() {
  const form = useForm<OrderForm>({
    defaultValues: {
      quantity: 0,
      entries: [{ price: null }],
      stopPrice: 0,
      limitPrice: 0,
    },
  });

  const entries = useFieldArray({ control: form.control, name: "entries" });

  return (
    // <div>
    <Tabs defaultValue="market" className="w-md">
      <TabsList className="w-full">
        <TabsTrigger value="market">Market</TabsTrigger>
        <TabsTrigger value="limit">Limit</TabsTrigger>
        <TabsTrigger value="other">Other</TabsTrigger>
      </TabsList>
      <TabsContent value="market" className="flex flex-col space-y-2">
        <Input type="number" placeholder="Quantity" />
        <Input type="number" />
      </TabsContent>

      <TabsContent value="limit">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Limit</CardTitle>
            <CardDescription>Limit Order</CardDescription>
          </CardHeader>

          <CardContent className="flex flex-col space-y-2">
            <FormField
              control={form.control}
              name="quantity"
              render={() => {
                return (
                  <Label
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    htmlFor="quantity"
                  >
                    Quantity
                    <Input type="number" placeholder="Quantity" id="quantity" />
                  </Label>
                );
              }}
            />
            <Separator />
            {entries.fields.map((entry, index) => {
              return (
                <div key={entry.id}>
                  <FormField
                    control={form.control}
                    name={`entries.${index}.price`}
                    render={() => {
                      return (
                        <Label
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                          htmlFor="limit"
                        >
                          Entry
                          <Input
                            type="number"
                            placeholder="Price"
                            id={`entries.${index}.price`}
                            value={entry.price ?? ""}
                            onChange={() => {}}
                          />
                        </Label>
                      );
                    }}
                  />
                </div>
              );
            })}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-red-500 hover:bg-red-100"
              onClick={() => entries.append({ price: null })}
              aria-label="Remove Stop Loss"
            >
              Add
            </Button>
          </CardContent>
        </Card>
      </TabsContent>
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
