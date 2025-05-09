import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "@/contexts/AppContext";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GroupCard } from "@/components/GroupCard";
import { getUserGroups, ensureAuthenticated } from "@/lib/firebase";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Search, Users } from "lucide-react";

export default function Groups() {
  const { user } = useApp();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [groups, setGroups] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (user) {
      const fetchGroups = async () => {
        try {
          // Ensure authentication before fetching data
          await ensureAuthenticated(user.walletAddress);
          const userGroups = await getUserGroups(user.id);
          setGroups(userGroups);
        } catch (error) {
          console.error("Error fetching groups:", error);
        } finally {
          setIsLoading(false);
        }
      };

      fetchGroups();
    }
  }, [user]);

  const filteredGroups = groups.filter(group =>
    group.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!user) {
    navigate("/");
    return null;
  }

  return (
    <Layout>
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex flex-col md:flex-row gap-4 justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Groups</h1>
            <p className="text-muted-foreground">
              Manage and view all your expense groups
            </p>
          </div>
          <Button onClick={() => navigate("/groups/create")}>
            <Plus className="mr-2 h-4 w-4" /> Create Group
          </Button>
        </div>

        <div className="flex items-center space-x-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search groups..."
              className="pl-8"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-40 w-full" />
            ))}
          </div>
        ) : filteredGroups.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredGroups.map((group) => {
              // Get member data, ensuring we handle all formats correctly
              let memberNames: string[] = [];
              
              if (group.members && Array.isArray(group.members)) {
                memberNames = group.members.map((memberId: string) => {
                  // First check memberDetails if available
                  if (group.memberDetails && group.memberDetails[memberId]) {
                    return group.memberDetails[memberId].name || group.memberDetails[memberId].displayName || memberId.slice(0, 6);
                  }
                  
                  // If no memberDetails or no name found, use wallet address
                  return memberId.slice(0, 6) + "..."; 
                });
              }
              
              return (
                <GroupCard
                  key={group.id}
                  group={{
                    id: group.id,
                    name: group.name,
                    description: group.description,
                    members: group.members || [],
                    memberNames: memberNames,
                    totalExpenses: group.totalExpenses || 0,
                    defaultCurrency: group.defaultCurrency || "USD",
                    expenseCount: group.expenses?.length || 0,
                  }}
                  onClick={() => navigate(`/groups/${group.id}`)}
                />
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
              <Users className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium">No Groups Found</h3>
            <p className="text-sm text-muted-foreground mt-1 mb-4">
              {searchQuery
                ? "No groups match your search. Try a different query."
                : "You haven't created or joined any groups yet."}
            </p>
            <Button onClick={() => navigate("/groups/create")}>
              <Plus className="mr-2 h-4 w-4" /> Create Group
            </Button>
          </div>
        )}
      </div>
    </Layout>
  );
}