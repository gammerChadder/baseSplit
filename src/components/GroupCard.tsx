import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { formatCurrency } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface GroupCardProps {
  group: {
    id: string;
    name: string;
    description?: string;
    members: string[];
    memberNames?: string[];
    totalExpenses: number;
    defaultCurrency: string;
    expenseCount?: number;
  };
  onClick?: () => void;
}

export function GroupCard({ group, onClick }: GroupCardProps) {
  // Ensure we have memberNames array with proper formatting
  const displayMembers = group.memberNames?.length ? group.memberNames : 
    group.members.map(member => member.slice(0, 6) + "...");

  return (
    <Card 
      className={cn(
        "transition-all hover:shadow-md overflow-hidden",
        onClick && "cursor-pointer hover:-translate-y-1"
      )}
      onClick={onClick}
    >
      <div className="h-1.5 w-full bg-base-gradient"></div>
      <CardHeader className="p-4 pb-2">
        <div className="flex justify-between">
          <CardTitle className="text-base font-medium">{group.name}</CardTitle>
          <Badge variant="outline" className="bg-base-blue/10 text-base-blue">
            {formatCurrency(group.totalExpenses, group.defaultCurrency as any)}
          </Badge>
        </div>
        {group.description && (
          <p className="text-sm text-muted-foreground">{group.description}</p>
        )}
      </CardHeader>
      <CardContent className="p-4 pt-2">
        <div className="flex justify-between items-center">
          <div className="flex -space-x-2">
            {displayMembers.slice(0, 4).map((name, i) => (
              <Tooltip key={i}>
                <TooltipTrigger asChild>
                  <Avatar className="h-8 w-8 border-2 border-background">
                    <AvatarFallback className="text-xs">
                      {name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{name}</p>
                </TooltipContent>
              </Tooltip>
            ))}
            {displayMembers.length > 4 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Avatar className="h-8 w-8 border-2 border-background">
                    <AvatarFallback className="text-xs bg-muted">
                      +{displayMembers.length - 4}
                    </AvatarFallback>
                  </Avatar>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{displayMembers.length - 4} more members</p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
          {group.expenseCount !== undefined && (
            <span className="text-xs text-muted-foreground">
              {group.expenseCount} {group.expenseCount === 1 ? "expense" : "expenses"}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}